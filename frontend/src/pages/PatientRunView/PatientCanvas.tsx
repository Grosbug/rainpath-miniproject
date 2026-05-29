import { useMemo } from 'react'
import {
  ReactFlow, ReactFlowProvider, Controls,
  useStore as useRFStore, useViewport,
  type Node as RFNode, type Edge as RFEdge, type NodeTypes
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Graph } from '@rainpath/shared'
import { computeReachability } from '@rainpath/shared'
import { TimelineBackground } from '@/pages/WorkflowEditor/TimelineBackground'
import { edgeTypes } from '@/pages/WorkflowEditor/edges/edge-types'
import { PatientNode, type PatientNodeData, type ReachabilityState } from './PatientNode'
import { computeLanes } from './compute-lanes'

const PX_PER_DAY = 28
// LANE_HEIGHT must be >= the actual rendered card height (~110–130 px with the
// "J+N" badge + reachability pill), plus a visual gap, otherwise cards on adjacent
// lanes touch / overlap vertically even though compute-lanes correctly assigned them.
const LANE_HEIGHT = 140
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
  currentNodeId: string | null
  history: { nodeId: string; outcome?: string }[]
  /** Day cursor for the time simulator (J+N from start). Renders a vertical "today" line. */
  dayCursor: number
}

function CanvasInner({ graph, profile, currentNodeId, history, dayCursor }: Props) {
  const reach: Map<string, ReachabilityState> = useMemo(
    () => computeReachability(
      graph,
      {
        email: profile.email,
        phone: profile.phone,
        whatsapp: profile.whatsapp,
        address: profile.address
      } as any,
      currentNodeId,
      history.map(h => h.nodeId) as any
    ) as Map<string, ReachabilityState>,
    [graph, profile.email, profile.phone, profile.whatsapp, profile.address, currentNodeId, history]
  )

  const lanes = useMemo(() => computeLanes(graph), [graph])

  const rfNodes: RFNode<PatientNodeData>[] = useMemo(() => {
    return graph.nodes.map(n => ({
      id: n.id,
      type: n.data.kind,
      position: {
        x: n.position.x * PX_PER_DAY,
        y: LANE_TOP_OFFSET + (lanes.get(n.id) ?? 0) * LANE_HEIGHT
      },
      data: {
        ...n.data,
        reachability: reach.get(n.id) ?? 'unreachable',
        _dayX: n.data.kind === 'start' ? undefined : Math.max(0, Math.round(n.position.x))
      } as PatientNodeData,
      draggable: false,
      selectable: false,
      focusable: false
    }))
  }, [graph.nodes, reach, lanes])

  const rfEdges: RFEdge[] = useMemo(() =>
    graph.edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      type: 'default',
      data: { daysAfter: e.daysAfter },
      selectable: false,
      focusable: false
    })),
    [graph.edges]
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
        maxZoom={1.5}
        fitView
        fitViewOptions={{ padding: 0.15 }}
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
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 4 }}>
      <svg width={widthPx} height={heightPx} className="block">
        <line
          x1={screenX} y1={0} x2={screenX} y2={heightPx}
          stroke="var(--primary)" strokeWidth={2} strokeDasharray="6 4" opacity={0.7}
        />
        <g transform={`translate(${screenX}, 14)`}>
          <rect x={-22} y={-11} width={44} height={20} rx={10} fill="var(--primary)" />
          <text
            x={0} y={3} textAnchor="middle"
            fontSize={11} fontFamily="var(--font-sans)" fontWeight={600}
            style={{ fontVariantNumeric: 'tabular-nums' }}
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
    { dot: 'bg-surface border border-border', label: 'À venir' },
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
