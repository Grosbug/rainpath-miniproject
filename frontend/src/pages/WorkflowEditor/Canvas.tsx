import { useCallback, useMemo, useState, MouseEvent, DragEvent } from 'react'
import {
  ReactFlow, MiniMap, Controls, useReactFlow, ReactFlowProvider,
  type Node as RFNode, type Edge as RFEdge,
  type NodeChange, type EdgeChange, type Connection
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { toast } from 'sonner'
import { useEditorStore } from './store'
import { nodeTypes } from './nodes/node-types'
import { edgeTypes } from './edges/edge-types'
import { TimelineBackground } from './TimelineBackground'
import { DaysAfterPopover } from './edges/DaysAfterPopover'
import { useModalState, type NodeKind } from './modal-state'

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

const REJECTION_MSG: Record<string, string> = {
  self_loop: 'Auto-connexion impossible',
  cycle: 'Boucle détectée — connexion impossible',
  handle_conflict: 'Ce handle a déjà une sortie',
  dangling: 'Nœud cible inexistant',
  edge_into_start: 'Impossible d\'entrer dans le nœud Départ',
  edge_from_end: 'Impossible de partir d\'un nœud Fin'
}

function CanvasInner() {
  const nodes = useEditorStore(s => s.nodes)
  const edges = useEditorStore(s => s.edges)
  const setSelectedNode = useEditorStore(s => s.setSelectedNode)
  const setSelectedEdge = useEditorStore(s => s.setSelectedEdge)
  const updateNodePositionY = useEditorStore(s => s.updateNodePositionY)
  const updateEdgeDays = useEditorStore(s => s.updateEdgeDays)
  const addNode = useEditorStore(s => s.addNode)
  const addEdge = useEditorStore(s => s.addEdge)
  const openModal = useModalState(s => s.open)
  const { screenToFlowPosition } = useReactFlow()

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

  const onConnect = useCallback((params: Connection) => {
    if (!params.source || !params.target) return
    const result = addEdge({
      source: params.source,
      target: params.target,
      sourceHandle: params.sourceHandle ?? undefined,
      daysAfter: 0
    })
    if (!result.ok) {
      const msg = REJECTION_MSG[result.reason] ?? 'Connexion impossible'
      toast.error(msg)
    }
  }, [addEdge])

  const onDragOver = useCallback((e: DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-rainpath-palette')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  const onDrop = useCallback((e: DragEvent) => {
    const raw = e.dataTransfer.getData('application/x-rainpath-palette')
    if (!raw) return
    e.preventDefault()

    let payload: { kind: 'start' | 'end' | 'template'; templateId?: string }
    try { payload = JSON.parse(raw) } catch { return }

    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const atY = flowPos.y

    if (payload.kind === 'start') {
      addNode({ kind: 'start', data: { kind: 'start' } as any, atY })
      return
    }
    if (payload.kind === 'end') {
      addNode({ kind: 'end', data: { kind: 'end' } as any, atY })
      return
    }
    if (payload.kind === 'template') {
      const tmplRaw = e.dataTransfer.getData('application/x-rainpath-template')
      if (!tmplRaw) return
      try {
        const tmpl = JSON.parse(tmplRaw) as { kind: NodeKind; params: unknown }
        addNode({
          kind: tmpl.kind,
          data: { kind: tmpl.kind, params: structuredClone(tmpl.params) } as any,
          atY
        })
      } catch {
        toast.error('Modèle invalide')
      }
    }
  }, [addNode, screenToFlowPosition])

  const onNodeDoubleClick = useCallback((_e: MouseEvent, rfNode: RFNode) => {
    const node = nodes.find(n => n.id === rfNode.id)
    if (!node) return
    if (node.data.kind === 'start' || node.data.kind === 'end') return
    openModal({ mode: 'node-edit', nodeId: node.id, kind: node.data.kind as NodeKind })
  }, [nodes, openModal])

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
    <div className='relative h-full w-full' onClick={onCanvasClick} onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDoubleClick={onNodeDoubleClick}
        nodesConnectable
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

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}
