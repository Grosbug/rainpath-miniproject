import { useMemo } from 'react'
import {
  ReactFlow, ReactFlowProvider, Controls,
  useStore as useRFStore, useViewport,
  type Node as RFNode, type Edge as RFEdge, type NodeTypes
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Graph, RunHistoryEntry } from '@rainpath/shared'
import {
  hasExitedNode,
  isUpcomingFromOpenBranch,
  stuckReasonForNode
} from './run-frontiers-ui'
import { observableStatusesForSendNode } from './outcome-routing'
import { TimelineBackground } from '@/pages/WorkflowEditor/TimelineBackground'
import { edgeTypes } from '@/pages/WorkflowEditor/edges/edge-types'
import { resolveEdgeDisplayHandle, routeLabelForHandle } from '@/pages/WorkflowEditor/edges/edge-visual'
import { useLeftAnchoredZoom } from '@/pages/WorkflowEditor/hooks/useLeftAnchoredZoom'
import { PatientNode, type PatientNodeData, type ReachabilityState } from './PatientNode'
import { computeLanes } from './compute-lanes'
import { traversedEdgeIds, type PatientContactData } from './cumulative-days'

const PX_PER_DAY = 28
// LANE_HEIGHT must be >= the actual rendered card height (~110–130 px with the
// "J+N" badge + reachability pill, +50–70 px when the `current` card sprouts
// its inline status picker), plus a visual gap, otherwise cards on adjacent
// lanes touch / overlap vertically even though compute-lanes correctly assigned them.
const LANE_HEIGHT = 200
const LANE_TOP_OFFSET = 40

const nodeTypes: NodeTypes = {
  start: PatientNode,
  end: PatientNode,
  send_email: PatientNode,
  send_sms: PatientNode,
  send_whatsapp: PatientNode,
  send_postal: PatientNode
}

interface PatientProfileShape {
  email: string | null
  phone: string | null
  whatsapp: string | null
  address: { street: string; postalCode: string; city: string; country?: string | null } | null
}

interface Props {
  graph: Graph
  profile: PatientProfileShape
  focusedNodeId: string | null
  activeFrontiers: readonly string[]
  actionableNodeIds: readonly string[]
  history: RunHistoryEntry[]
  dayCursor: number
  pendingByNode: Readonly<Record<string, string | undefined>>
  onPendingChange: (nodeId: string, status: string | undefined) => void
  /** Select which parallel branch (or visited node) is active — no extra chrome. */
  onFocusNode: (nodeId: string) => void
}

function displayReachability(
  graph: Graph,
  nodeId: string,
  focusedNodeId: string | null,
  history: RunHistoryEntry[],
  activeFrontiers: readonly string[]
): { state: ReachabilityState; blockedReason?: string } {
  const visited = new Set(history.map(h => h.nodeId))
  if (focusedNodeId === nodeId) return { state: 'current' }
  if (visited.has(nodeId) && !hasExitedNode(graph, history, nodeId)) {
    const reason = stuckReasonForNode(graph, history, nodeId)
    if (reason) return { state: 'blocked', blockedReason: reason }
  }
  if (visited.has(nodeId)) return { state: 'visited' }
  if (activeFrontiers.includes(nodeId)) return { state: 'reachable' }
  if (isUpcomingFromOpenBranch(graph, history, nodeId)) return { state: 'reachable' }
  return { state: 'unreachable' }
}

function CanvasInner({
  graph, profile, focusedNodeId, activeFrontiers, actionableNodeIds,
  history, dayCursor, pendingByNode, onPendingChange, onFocusNode
}: Props) {
  // 40 px of breathing room left of J+0 so the rail (vertical green line in
  // TimelineBackground) and the first node card stay clear of the canvas edge
  // at any zoom level — mirrors the editor's left-anchored zoom behavior.
  useLeftAnchoredZoom(40)

  const lanes = useMemo(() => computeLanes(graph), [graph])

  const contactProfile: PatientContactData = useMemo(() => ({
    email: profile.email,
    phone: profile.phone,
    whatsapp: profile.whatsapp,
    address: profile.address
  }), [profile.email, profile.phone, profile.whatsapp, profile.address])

  const historyOutcomeByNode = useMemo(() => {
    const m = new Map<string, string>()
    for (const h of history) {
      if (h.outcome !== undefined) m.set(h.nodeId, h.outcome)
    }
    return m
  }, [history])

  const rfNodes: RFNode<PatientNodeData>[] = useMemo(() => {
    return graph.nodes.map(n => {
      const { state: reachability, blockedReason } = displayReachability(
        graph, n.id, focusedNodeId, history, activeFrontiers
      )
      const lastHistId = history.length > 0 ? history[history.length - 1]!.nodeId : null
      const isCurrent =
        reachability === 'current' ||
        (n.id === focusedNodeId && n.id === lastHistId && n.data.kind === 'end')
      const canFocus = actionableNodeIds.includes(n.id) && !isCurrent
      const isSend = n.data.kind.startsWith('send_')
      return {
        id: n.id,
        type: n.data.kind,
        position: {
          x: n.position.x * PX_PER_DAY,
          y: LANE_TOP_OFFSET + (lanes.get(n.id) ?? 0) * LANE_HEIGHT
        },
        data: {
          ...n.data,
          reachability,
          blockedReason,
          _dayX: n.data.kind === 'start' ? undefined : Math.max(0, Math.round(n.position.x)),
          _profile: contactProfile,
          _pendingStatus: isCurrent
            ? (pendingByNode[n.id] ?? historyOutcomeByNode.get(n.id))
            : undefined,
          _onPickStatus: isCurrent ? (s: string | undefined) => onPendingChange(n.id, s) : undefined,
          _onFocus: canFocus ? () => onFocusNode(n.id) : undefined,
          _graphNode: isSend ? n : undefined,
          _graph: isSend ? graph : undefined,
          _nodeId: isSend ? n.id : undefined,
          _observableStatuses: isSend
            ? observableStatusesForSendNode(graph, n.id, n, contactProfile)
            : undefined
        } as PatientNodeData,
        draggable: false,
        selectable: false,
        focusable: canFocus
      }
    })
  }, [graph, graph.nodes, focusedNodeId, activeFrontiers, actionableNodeIds, history, historyOutcomeByNode, lanes, contactProfile, pendingByNode, onPendingChange, onFocusNode])

  const traversedEdges = useMemo(() => traversedEdgeIds(graph, history), [graph, history])

  const rfEdges: RFEdge[] = useMemo(() =>
    graph.edges.map(e => {
      const routeHandle = resolveEdgeDisplayHandle(e)
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        // React Flow v12's Edge object expects `sourceHandle` (not `sourceHandleId`,
        // which is only the prop NAME on EdgeProps). Using the wrong key here makes
        // RF silently ignore the handle binding and anchor every edge on the first
        // source slot — visually merging échec branches into the succès handle.
        sourceHandle: routeHandle ?? e.sourceHandle ?? null,
        type: 'default',
        data: {
          daysAfter: e.daysAfter,
          routeHandle,
          routeLabel: routeLabelForHandle(routeHandle),
          routeRevealed: traversedEdges.has(e.id)
        },
        selectable: false,
        focusable: false
      }
    }),
    [graph, traversedEdges]
  )

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesConnectable={false}
        nodesDraggable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
        minZoom={0.4}
        maxZoom={2}
        translateExtent={[[-48, -Infinity], [Infinity, Infinity]]}
        fitView
        fitViewOptions={{ padding: 0.05 }}
      >
        <TimelineBackground />
        <TodayCursor day={dayCursor} />
        <Controls
          className="!bg-surface !border-border"
          position="bottom-center"
          orientation="horizontal"
          showInteractive={false}
        />
      </ReactFlow>
      <Legend />
    </div>
  )
}

function TodayCursor({ day }: { day: number }) {
  const viewport = useViewport()
  const widthPx = useRFStore(s => s.width)
  const heightPx = useRFStore(s => s.height)
  if (day <= 0) return null
  const screenX = day * PX_PER_DAY * viewport.zoom + viewport.x
  if (screenX < 0 || screenX > widthPx) return null
  // z-index 2 puts the cursor above edges (z-index 1) but UNDER node cards
  // (z-index 3–4 in React Flow v12). Combined with explicit pointer-events:none
  // on every SVG node (the CSS inheritance isn't always honored by SVG paint
  // elements like <rect>/<text>), this guarantees the cursor never blocks
  // clicks on inline node controls (status picker dropdown trigger).
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 2 }}>
      <svg
        width={widthPx} height={heightPx}
        className="block"
        style={{ pointerEvents: 'none' }}
      >
        <line
          x1={screenX} y1={0} x2={screenX} y2={heightPx}
          stroke="var(--primary)" strokeWidth={2} strokeDasharray="6 4" opacity={0.7}
          style={{ pointerEvents: 'none' }}
        />
        <g transform={`translate(${screenX}, 14)`} style={{ pointerEvents: 'none' }}>
          <rect
            x={-22} y={-11} width={44} height={20} rx={10}
            fill="var(--primary)"
            style={{ pointerEvents: 'none' }}
          />
          <text
            x={0} y={3} textAnchor="middle"
            fontSize={11} fontFamily="var(--font-sans)" fontWeight={600}
            style={{ fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}
            fill="white"
          >
            J+{day}
          </text>
        </g>
      </svg>
    </div>
  )
}

function Legend() {
  const items: { dot: string; label: string }[] = [
    { dot: 'bg-success', label: 'Terminé' },
    { dot: 'bg-primary animate-pulse', label: 'En cours' },
    { dot: 'bg-primary-soft border border-primary/30', label: 'À traiter' },
    { dot: 'bg-danger', label: 'Bloqué' },
    { dot: 'bg-fg-subtle/40', label: 'Inatteignable' }
  ]
  return (
    <div
      className="pointer-events-none absolute bottom-4 right-4 z-10 rounded-md border border-border/60 bg-surface/70 px-3 py-2 text-xs shadow-elev-1 backdrop-blur-md"
      aria-label="Légende des états du parcours"
    >
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">État du parcours</p>
      <ul className="space-y-1">
        {items.map(it => (
          <li key={it.label} className="flex items-center gap-2 text-fg">
            <span className={`inline-block h-2 w-2 rounded-full ${it.dot}`} aria-hidden="true" />
            <span>{it.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PatientCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}
