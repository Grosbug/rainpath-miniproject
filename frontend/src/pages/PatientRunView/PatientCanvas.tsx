import { useMemo } from 'react'
import {
  ReactFlow, ReactFlowProvider, MiniMap, Controls,
  type Node as RFNode, type Edge as RFEdge, type NodeTypes
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Graph } from '@rainpath/shared'
import { computeReachability } from '@rainpath/shared'
import { TimelineBackground } from '@/pages/WorkflowEditor/TimelineBackground'
import { edgeTypes } from '@/pages/WorkflowEditor/edges/edge-types'
import { PatientNode, type PatientNodeData, type ReachabilityState } from './PatientNode'

const PX_PER_DAY = 28

const nodeTypes: NodeTypes = {
  start: PatientNode,
  end: PatientNode,
  send_email: PatientNode,
  send_sms: PatientNode,
  send_whatsapp: PatientNode,
  send_postal: PatientNode,
  condition: PatientNode
}

interface PatientProfileShape {
  email: string | null
  phone: string | null
  whatsapp: string | null
  address: string | null
}

interface Props {
  graph: Graph
  profile: PatientProfileShape
  currentNodeId: string | null
  history: { nodeId: string; outcome?: string }[]
}

function CanvasInner({ graph, profile, currentNodeId, history }: Props) {
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

  const rfNodes: RFNode<PatientNodeData>[] = useMemo(() => {
    return graph.nodes.map(n => ({
      id: n.id,
      type: n.data.kind,
      position: { x: n.position.x * PX_PER_DAY, y: n.position.y },
      data: { ...n.data, reachability: reach.get(n.id) ?? 'unreachable' } as PatientNodeData,
      draggable: false,
      selectable: false,
      focusable: false
    }))
  }, [graph.nodes, reach])

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
    <div className="h-full w-full">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesConnectable={false}
        nodesDraggable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
        fitView
      >
        <TimelineBackground />
        <Controls className="!bg-surface !border-border" showInteractive={false} />
        <MiniMap className="!bg-surface-muted !border-border" pannable zoomable />
      </ReactFlow>
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
