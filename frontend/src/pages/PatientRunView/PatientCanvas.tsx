import { useMemo, useRef, useState } from 'react'
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
import { Icon } from '@/components/Icon'
import { computeLanes } from './compute-lanes'
import { canvasDayForNode, traversedEdgeIds, type PatientContactData } from './cumulative-days'
import { usePxPerDay } from '@/canvas/time-scale'
import { useTimeStretchGesture } from '@/canvas/useTimeStretchGesture'
// LANE_HEIGHT / LANE_TOP_OFFSET only kick in as a FALLBACK for nodes whose
// editor position.y was never set (legacy graphs, orphans that bypassed the
// editor's drag flow). For every node where the editor stored a real Y, we
// honor that Y straight through so the patient canvas mirrors the disposition
// the user authored — see `yPositionFor` below. The bump from 200→240 gives
// the focus-expanded picker card room to grow without colliding with adjacent
// lanes when the fallback is in play.
const LANE_HEIGHT = 240
const LANE_TOP_OFFSET = 40

// `maxZoom: 1` stops short patient runs (few cards) from being framed at full
// 2× zoom on load, which made the canvas look zoomed-in by default. Feeds the
// <ReactFlow fitView /> prop, which owns the mount-time framing; useLeftAnchoredZoom
// then only re-anchors viewport.x and never re-fits.
const FIT_VIEW_OPTIONS = { padding: 0.05, maxZoom: 1 } as const

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

  const pxPerDay = usePxPerDay()
  const paneRef = useRef<HTMLDivElement>(null)
  useTimeStretchGesture(paneRef)

  const lanes = useMemo(() => computeLanes(graph), [graph])

  // Honor the editor's `position.y` straight through so the patient view
  // mirrors the disposition the user laid out. Lane bucketing is kept ONLY as
  // a fallback for nodes that arrived without an authored Y (y === 0 or
  // missing — usually legacy graphs or programmatically-seeded fixtures).
  // The previous "always bucket into lanes" approach made every patient run
  // look nothing like the editor it came from, which was the disorienting
  // part of the bug report.
  const yPositionFor = useMemo(() => {
    return (n: Graph['nodes'][number]): number => {
      const authored = n.position.y
      if (typeof authored === 'number' && authored > 0) return authored
      return LANE_TOP_OFFSET + (lanes.get(n.id) ?? 0) * LANE_HEIGHT
    }
  }, [lanes])

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
      // Picker shows on every actionable send_* card — the focused one AND
      // the other open frontiers / leave-pending nodes — so the operator can
      // queue up statuses in parallel. The "Prochain" handler then chains
      // through them in chrono order, processing each pre-pick automatically
      // until it hits a node without a staged status.
      const pickerEnabled = isSend && actionableNodeIds.includes(n.id)
      // X follows the patient's REAL run day for cards on the actual path (so
      // the J+N cursor — same basis — lands on the focused card), falling back
      // to the static layout X for not-yet-reached nodes. See canvasDayForNode.
      const canvasDay = canvasDayForNode(graph, history, focusedNodeId, activeFrontiers, n)
      return {
        id: n.id,
        type: n.data.kind,
        position: {
          x: canvasDay * pxPerDay,
          y: yPositionFor(n)
        },
        data: {
          ...n.data,
          reachability,
          blockedReason,
          _dayX: n.data.kind === 'start' ? undefined : Math.max(0, Math.round(canvasDay)),
          _profile: contactProfile,
          _pendingStatus: pickerEnabled
            ? (pendingByNode[n.id] ?? historyOutcomeByNode.get(n.id))
            : undefined,
          _onPickStatus: pickerEnabled ? (s: string | undefined) => onPendingChange(n.id, s) : undefined,
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
        focusable: canFocus,
        // React Flow v12 writes an inline z-index on every node wrapper. Without
        // an explicit value the default stacking can let a neighbor's wrapper
        // paint over a card that grew to host its inline status picker, hiding
        // the picker's clickable area. Lift the focused node above everything,
        // and any picker-enabled (grown) node above ordinary cards.
        zIndex: isCurrent ? 1000 : pickerEnabled ? 100 : 1
      }
    })
  }, [graph, graph.nodes, focusedNodeId, activeFrontiers, actionableNodeIds, history, historyOutcomeByNode, yPositionFor, contactProfile, pendingByNode, pxPerDay, onPendingChange, onFocusNode])

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
    <div ref={paneRef} className="rp-patient-canvas relative h-full w-full">
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
        zoomOnScroll={false}
        zoomOnPinch={false}
        panOnScroll
        translateExtent={[[-48, -Infinity], [Infinity, Infinity]]}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
      >
        <TimelineBackground />
        <TodayCursor day={dayCursor} />
        <Controls
          className="!bg-surface !border-border"
          position="bottom-left"
          orientation="vertical"
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
  const pxPerDay = usePxPerDay()
  if (day < 0) return null
  const screenX = day * pxPerDay * viewport.zoom + viewport.x
  if (screenX < 0 || screenX > widthPx) return null
  // Two layers: the dashed line sits UNDER the edges (z=0) so it can't paint
  // over the traversed-edge ink, the J+N pill stays at z=3 above the line so
  // it remains readable. Combined with explicit pointer-events:none on every
  // SVG node (CSS inheritance isn't always honored on `<rect>/<text>`), this
  // guarantees the cursor never blocks clicks on the inline picker trigger.
  return (
    <>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
        <svg width={widthPx} height={heightPx} className="block" style={{ pointerEvents: 'none' }}>
          <line
            x1={screenX} y1={0} x2={screenX} y2={heightPx}
            stroke="var(--primary)" strokeWidth={2} strokeDasharray="6 4" opacity={0.5}
            style={{ pointerEvents: 'none' }}
          />
        </svg>
      </div>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 3 }}>
        <svg width={widthPx} height={heightPx} className="block" style={{ pointerEvents: 'none' }}>
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
    </>
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
  const [open, setOpen] = useState(false)
  // Moved from `bottom-4 right-4` (which sat on top of late-graph nodes at fit
  // zoom) to a collapsed pill in the top-right corner. The pill stays out of
  // the canvas flow until the user opens it. Bottom-center is already busy
  // with React Flow's <Controls>; top-left is the workflow title; top-right
  // is the only canvas corner reliably empty across workflow shapes.
  return (
    <div className="absolute right-12 top-12 z-10 flex flex-col items-end" aria-label="Légende des états du parcours">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border/60 bg-surface/80 px-2 text-[11px] font-medium text-fg shadow-elev-1 backdrop-blur-md hover:bg-surface"
      >
        Légende
        <Icon name={open ? 'ChevronUp' : 'ChevronDown'} size={16} className="text-fg-muted" />
      </button>
      {open ? (
        <div className="mt-1 rounded-md border border-border/60 bg-surface/95 px-3 py-2 text-xs shadow-elev-1 backdrop-blur-md">
          <ul className="space-y-1">
            {items.map(it => (
              <li key={it.label} className="flex items-center gap-2 text-fg">
                <span className={`inline-block h-2 w-2 rounded-full ${it.dot}`} aria-hidden="true" />
                <span>{it.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
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
