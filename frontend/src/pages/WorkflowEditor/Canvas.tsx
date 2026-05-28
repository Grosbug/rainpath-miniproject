import { useCallback, useMemo, useState, MouseEvent } from 'react'
import {
  ReactFlow, MiniMap, Controls,
  type Node as RFNode, type Edge as RFEdge,
  type NodeChange, type EdgeChange
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useEditorStore } from './store'
import { nodeTypes } from './nodes/node-types'
import { edgeTypes } from './edges/edge-types'
import { TimelineBackground } from './TimelineBackground'
import { DaysAfterPopover } from './edges/DaysAfterPopover'

const PX_PER_DAY = 28

function toRFNodes(nodes: ReturnType<typeof useEditorStore.getState>['nodes']): RFNode[] {
  return nodes.map(n => ({
    id: n.id,
    type: n.data.kind,
    position: { x: n.position.x * PX_PER_DAY, y: n.position.y },
    data: n.data,
    draggable: n.data.kind !== 'start'
  }))
}

function toRFEdges(edges: ReturnType<typeof useEditorStore.getState>['edges']): RFEdge[] {
  return edges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? null,
    type: 'default',
    data: { daysAfter: e.daysAfter }
  }))
}

export function Canvas() {
  const nodes = useEditorStore(s => s.nodes)
  const edges = useEditorStore(s => s.edges)
  const setSelectedNode = useEditorStore(s => s.setSelectedNode)
  const setSelectedEdge = useEditorStore(s => s.setSelectedEdge)
  const updateNodePositionY = useEditorStore(s => s.updateNodePositionY)
  const updateEdgeDays = useEditorStore(s => s.updateEdgeDays)

  const rfNodes = useMemo(() => toRFNodes(nodes), [nodes])
  const rfEdges = useMemo(() => toRFEdges(edges), [edges])

  const [popover, setPopover] = useState<{ edgeId: string; anchor: { x: number; y: number } } | null>(null)

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const ch of changes) {
        if (ch.type === 'select' && 'selected' in ch) {
          setSelectedNode(ch.selected ? ch.id : null)
        }
        if (ch.type === 'position' && ch.position && ch.dragging) {
          const id = ch.id
          const node = nodes.find(n => n.id === id)
          if (node && node.data.kind !== 'start') {
            updateNodePositionY(id, ch.position.y)
          }
        }
      }
    },
    [nodes, setSelectedNode, updateNodePositionY]
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const ch of changes) {
        if (ch.type === 'select' && 'selected' in ch) {
          setSelectedEdge(ch.selected ? ch.id : null)
        }
      }
    },
    [setSelectedEdge]
  )

  /**
   * Open the daysAfter popover when the chip is clicked. The chip carries
   * `data-edge-label-id={id}` from FlowEdge.tsx.
   */
  const onCanvasClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    const chip = target.closest('[data-edge-label-id]') as HTMLElement | null
    if (chip) {
      const id = chip.dataset['edgeLabelId']!
      const rect = chip.getBoundingClientRect()
      setPopover({ edgeId: id, anchor: { x: rect.left + rect.width / 2, y: rect.top } })
    }
  }, [])

  const popoverEdge = popover ? edges.find(e => e.id === popover.edgeId) ?? null : null

  return (
    <div className='relative h-full w-full' onClick={onCanvasClick}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodesConnectable={false}
        deleteKeyCode={null}
        proOptions={{ hideAttribution: true }}
        fitView
      >
        <TimelineBackground />
        <Controls className='!bg-surface !border-border' showInteractive={false} />
        <MiniMap className='!bg-surface-muted !border-border' pannable zoomable />
      </ReactFlow>

      <DaysAfterPopover
        open={!!popover && !!popoverEdge}
        anchor={popover?.anchor ?? null}
        initialValue={popoverEdge?.daysAfter ?? 0}
        onCommit={value => {
          if (popover) updateEdgeDays(popover.edgeId, value)
          setPopover(null)
        }}
        onCancel={() => setPopover(null)}
      />
    </div>
  )
}
