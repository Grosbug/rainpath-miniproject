import { useCallback, useEffect, useMemo, useRef, useState, MouseEvent, DragEvent } from 'react'
import {
  ReactFlow, Controls, useReactFlow, ReactFlowProvider,
  type Node as RFNode, type Edge as RFEdge,
  type NodeChange, type EdgeChange, type Connection
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { showAnchoredToast } from '@/components/AnchoredToasts'
import { useEditorStore } from './store'
import { nodeTypes } from './nodes/node-types'
import { edgeTypes } from './edges/edge-types'
import { resolveEdgeDisplayHandle, routeLabelForHandle } from './edges/edge-visual'
import { TimelineBackground } from './TimelineBackground'
import { DaysAfterPopover } from './edges/DaysAfterPopover'
import { useModalState, type NodeKind } from './modal-state'
import { useLeftAnchoredZoom } from './hooks/useLeftAnchoredZoom'
import { useClickConnection } from './hooks/useClickConnection'
import { ConnectionPreview } from './ConnectionPreview'
import { useEdgeHover } from './edges/edge-hover-state'

const PX_PER_DAY = 28

// `maxZoom: 1` caps the opening fit: without it a small graph (a few nodes)
// gets framed at maxZoom, which reads as "opened at full zoom". Larger graphs
// still zoom out to fit. Feeds the <ReactFlow fitView /> prop, which owns the
// mount-time framing; useLeftAnchoredZoom then only re-anchors viewport.x and
// never re-fits.
const FIT_VIEW_OPTIONS = { padding: 0.2, maxZoom: 1 } as const

// Stacks above the default node z-index (0) so the source/target nodes of a
// hovered edge lift their handles + card above neighbours. Stays below the
// EdgeLabelRenderer portal (z-index 1500) so the hovered edge's overlay path
// still sits cleanly on top of the lifted handles.
const HOVERED_EDGE_NODE_Z = 1000

function toRFNodes(
  nodes: ReturnType<typeof useEditorStore.getState>['nodes'],
  errors: ReturnType<typeof useEditorStore.getState>['validationErrors'],
  warnings: ReturnType<typeof useEditorStore.getState>['validationWarnings'],
  liftedNodeIds: ReadonlySet<string> | null
): RFNode[] {
  // Index validation issues by nodeId so the node renderer can show a small alert badge
  // on the affected card. Counts (not just booleans) so the tooltip can say "3 erreurs".
  const errorByNode = new Map<string, number>()
  const warningByNode = new Map<string, number>()
  for (const e of errors) {
    if (e.nodeId) errorByNode.set(e.nodeId, (errorByNode.get(e.nodeId) ?? 0) + 1)
  }
  for (const w of warnings) {
    if (w.nodeId) warningByNode.set(w.nodeId, (warningByNode.get(w.nodeId) ?? 0) + 1)
  }
  return nodes.map(n => ({
    id: n.id,
    type: n.data.kind,
    position: { x: n.position.x * PX_PER_DAY, y: n.position.y },
    // Inject _dayX (cumulative delay from start, in days) + _errorCount / _warningCount
    // so node renderers can show a "J+N" badge and an alert pip. Non-store fields — not
    // persisted (toRFNodes is read-only mapping).
    data: {
      ...n.data,
      _dayX: Math.max(0, Math.round(n.position.x)),
      _errorCount: errorByNode.get(n.id) ?? 0,
      _warningCount: warningByNode.get(n.id) ?? 0
    },
    draggable: n.data.kind !== 'start',
    ...(liftedNodeIds?.has(n.id) ? { zIndex: HOVERED_EDGE_NODE_Z } : null)
  }))
}

function toRFEdges(edges: ReturnType<typeof useEditorStore.getState>['edges']): RFEdge[] {
  return edges.map(e => {
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
        routeRevealed: true
      }
    }
  })
}

const REJECTION_MSG: Record<string, string> = {
  self_loop: 'Auto-connexion impossible',
  cycle: 'Boucle détectée — connexion impossible',
  dangling: 'Nœud cible inexistant',
  edge_into_start: 'Impossible d\'entrer dans le nœud Départ',
  edge_from_end: 'Impossible de partir d\'un nœud Fin',
  unreachable_source: 'Connectez d\'abord ce nœud au flux principal avant d\'en partir',
  invalid_source_handle: 'Reliez depuis la poignée Succès ou Échec du nœud (pas depuis le corps de la carte).'
}

function CanvasInner() {
  const nodes = useEditorStore(s => s.nodes)
  const edges = useEditorStore(s => s.edges)
  const validationErrors = useEditorStore(s => s.validationErrors)
  const validationWarnings = useEditorStore(s => s.validationWarnings)
  const setSelectedNode = useEditorStore(s => s.setSelectedNode)
  const setSelectedEdge = useEditorStore(s => s.setSelectedEdge)
  const updateNodePositionDrag = useEditorStore(s => s.updateNodePositionDrag)
  const commitNodePositionDrag = useEditorStore(s => s.commitNodePositionDrag)
  const removeEdge = useEditorStore(s => s.removeEdge)
  const addNode = useEditorStore(s => s.addNode)
  const addEdge = useEditorStore(s => s.addEdge)
  const openModal = useModalState(s => s.open)
  const modalOpen = useModalState(s => s.content !== null || s.overlayCount > 0)
  const { screenToFlowPosition, fitView, getInternalNode } = useReactFlow()
  const prettifyTick = useEditorStore(s => s.prettifyTick)
  // Snap the viewport to the new layout right after the user clicks Réorganiser
  // so they get an immediate "something happened" cue — without it, the rearrange
  // happens off-screen if their viewport is panned away.
  useEffect(() => {
    if (prettifyTick === 0) return
    const t = setTimeout(() => fitView({ duration: 350, padding: 0.15 }), 50)
    return () => clearTimeout(t)
  }, [prettifyTick, fitView])
  // 56 px of breathing room left of J+0 so the Start node and the timeline labels stay clear
// of the canvas left edge at any zoom level — without it, deep-zoomed views clip the origin.
useLeftAnchoredZoom(56)
  const { interaction, isValidConnection } = useClickConnection()

  // Track latest viewport-coords cursor so action-rejection toasts can anchor where the user
  // is currently aiming (onConnect doesn't expose the underlying MouseEvent).
  const mouseRef = useRef({ x: 0, y: 0 })
  useEffect(() => {
    const onMove = (e: globalThis.MouseEvent) => {
      mouseRef.current.x = e.clientX
      mouseRef.current.y = e.clientY
    }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [])

  // Source + target of the currently hovered edge — lifted above neighbouring
  // nodes so their handles are visible under the hovered edge's overlay path
  // (which already sits above nodes via the EdgeLabelRenderer portal). Kept
  // as a Set so toRFNodes can do an O(1) lookup per node.
  const hoveredEdgeId = useEdgeHover(s => s.hoveredEdgeId)
  const liftedNodeIds = useMemo<ReadonlySet<string> | null>(() => {
    if (!hoveredEdgeId) return null
    const edge = edges.find(e => e.id === hoveredEdgeId)
    if (!edge) return null
    return new Set([edge.source, edge.target])
  }, [hoveredEdgeId, edges])

  const rfNodes = useMemo(
    () => toRFNodes(nodes, validationErrors, validationWarnings, liftedNodeIds),
    [nodes, validationErrors, validationWarnings, liftedNodeIds]
  )
  const rfEdges = useMemo(() => toRFEdges(edges), [edges])

  const [popover, setPopover] = useState<{
    edgeId: string
    anchor: { left: number; right: number; y: number }
  } | null>(null)

  const dismissPopover = useCallback(() => {
    setPopover(null)
  }, [])

  const pinPopoverForChip = useCallback((chip: HTMLElement) => {
    const id = chip.dataset['edgeLabelId']
    if (!id) return
    const rect = chip.getBoundingClientRect()
    setPopover({
      edgeId: id,
      anchor: {
        left: rect.left,
        right: rect.right,
        y: rect.top + rect.height / 2
      }
    })
  }, [])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const ch of changes) {
        if (ch.type === 'select' && 'selected' in ch) {
          setSelectedNode(ch.selected ? ch.id : null)
        }
        if (ch.type === 'position' && ch.position) {
          const id = ch.id
          const node = nodes.find(n => n.id === id)
          if (!node || node.data.kind === 'start') continue
          // React Flow gives position in canvas pixels; X is day-units in the store.
          const dayX = ch.position.x / PX_PER_DAY
          if (ch.dragging) {
            updateNodePositionDrag(id, dayX, ch.position.y)
          } else {
            // Drag release: snap to nearest day, rewrite incoming edge's daysAfter, propagate.
            commitNodePositionDrag(id, dayX, ch.position.y)
          }
        }
      }
    },
    [nodes, setSelectedNode, updateNodePositionDrag, commitNodePositionDrag]
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
    // Pick daysAfter so the target keeps its current X. The layout invariant forces
    // target.X >= source.X — if target is currently left of source, it still snaps to source.X.
    const sourceNode = nodes.find(n => n.id === params.source)
    const targetNode = nodes.find(n => n.id === params.target)
    const daysAfter = sourceNode && targetNode
      ? Math.max(0, Math.round(targetNode.position.x - sourceNode.position.x))
      : 0
    // Only send_* nodes carry a meaningful sourceHandle; for others (start, end…)
    // strip whatever React Flow emitted so the stored edge stays clean and the duplicate-handle
    // check (which is type-aware) can't be confused by a stale id.
    const sourceHasDiscreteOutputs = !!sourceNode && sourceNode.data.kind.startsWith('send_')
    const normalizedHandle = sourceHasDiscreteOutputs
      ? (params.sourceHandle ?? undefined)
      : undefined
    const result = addEdge({
      source: params.source,
      target: params.target,
      sourceHandle: normalizedHandle,
      daysAfter
    })
    if (!result.ok) {
      const msg = REJECTION_MSG[result.reason] ?? 'Connexion impossible'
      showAnchoredToast({
        message: msg,
        type: 'error',
        x: mouseRef.current.x,
        y: mouseRef.current.y
      })
    }
  }, [addEdge, nodes])

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

    let payload: { kind: 'template'; templateId?: string }
    try { payload = JSON.parse(raw) } catch { return }

    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    // The drop point should become the node's CENTER, not its top-left. NodeCard width is
    // a constant 176px; height is content-driven so we use a best-effort estimate, then snap
    // to the exact center once React Flow has measured the freshly-mounted DOM (below).
    const NODE_WIDTH_PX = 176
    const ESTIMATED_HEIGHT_PX = 90
    const atX = (flowPos.x - NODE_WIDTH_PX / 2) / PX_PER_DAY
    const atY = flowPos.y - ESTIMATED_HEIGHT_PX / 2

    if (payload.kind === 'template') {
      const tmplRaw = e.dataTransfer.getData('application/x-rainpath-template')
      if (!tmplRaw) return
      try {
        const tmpl = JSON.parse(tmplRaw) as { kind: NodeKind; name?: string; params: Record<string, unknown> }
        // Stamp the template name onto the node's params as `displayName` so the card
        // shows the template's identity ("Première relance"…) instead of the body excerpt.
        // Only fills the field when not already set by the template itself.
        const params = structuredClone(tmpl.params)
        if (tmpl.name && typeof params === 'object' && params !== null && !('displayName' in params && (params as Record<string, unknown>).displayName)) {
          (params as Record<string, unknown>).displayName = tmpl.name
        }
        const newId = addNode({
          kind: tmpl.kind,
          data: { kind: tmpl.kind, params } as any,
          atX,
          atY
        })

        // Correction phase: ResizeObserver populates `measured` shortly after mount. Retry
        // a few RAFs in case the first one fires before measurement lands; bail silently if
        // it never does (the estimate already placed the node close enough).
        let attempts = 0
        const snapToMeasuredCenter = () => {
          const internal = getInternalNode(newId)
          const w = internal?.measured?.width
          const h = internal?.measured?.height
          if (w != null && h != null) {
            const exactX = Math.max(0, (flowPos.x - w / 2) / PX_PER_DAY)
            const exactY = flowPos.y - h / 2
            updateNodePositionDrag(newId, exactX, exactY)
            return
          }
          if (attempts++ < 5) requestAnimationFrame(snapToMeasuredCenter)
        }
        requestAnimationFrame(snapToMeasuredCenter)
      } catch {
        showAnchoredToast({ message: 'Modèle invalide', type: 'error', x: e.clientX, y: e.clientY })
      }
    }
  }, [addNode, screenToFlowPosition, getInternalNode, updateNodePositionDrag])

  const onNodeDoubleClick = useCallback((_e: MouseEvent, rfNode: RFNode) => {
    const node = nodes.find(n => n.id === rfNode.id)
    if (!node) return
    if (node.data.kind === 'start' || node.data.kind === 'end') return
    openModal({ mode: 'node-edit', nodeId: node.id, kind: node.data.kind as NodeKind })
  }, [nodes, openModal])

  const pinPopoverForEdge = useCallback((edgeId: string) => {
    const chip = document.querySelector(`[data-edge-label-id="${CSS.escape(edgeId)}"]`) as HTMLElement | null
    if (chip) pinPopoverForChip(chip)
  }, [pinPopoverForChip])

  const onEdgeClick = useCallback((_e: MouseEvent, edge: RFEdge) => {
    pinPopoverForEdge(edge.id)
  }, [pinPopoverForEdge])

  const setHoveredEdge = useEdgeHover(s => s.setHoveredEdge)
  const onEdgeMouseEnter = useCallback((_e: MouseEvent, edge: RFEdge) => {
    setHoveredEdge(edge.id)
  }, [setHoveredEdge])
  const onEdgeMouseLeave = useCallback(() => {
    setHoveredEdge(null)
  }, [setHoveredEdge])

  const onCanvasClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    const chip = target.closest('[data-edge-label-id]') as HTMLElement | null
    if (chip) {
      pinPopoverForChip(chip)
      return
    }
    if (!target.closest('[data-edge-actions]')) {
      dismissPopover()
    }
  }, [pinPopoverForChip, dismissPopover])

  const popoverEdge = popover ? edges.find(e => e.id === popover.edgeId) ?? null : null

  return (
    <div
      className='relative h-full w-full'
      onClick={onCanvasClick}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeClick={onEdgeClick}
        onEdgeMouseEnter={onEdgeMouseEnter}
        onEdgeMouseLeave={onEdgeMouseLeave}
        nodesConnectable
        connectOnClick={false}
        isValidConnection={isValidConnection}
        zoomOnDoubleClick={false}
        zoomOnScroll={!modalOpen && !popover}
        zoomOnPinch={!modalOpen && !popover}
        panOnDrag={[0, 1, 2]}
        selectionOnDrag={false}
        deleteKeyCode={null}
        proOptions={{ hideAttribution: true }}
        translateExtent={[[-360, -Infinity], [Infinity, Infinity]]}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
      >
        <TimelineBackground />
        <Controls
          className='!bg-surface !border-border'
          position='bottom-left'
          orientation='vertical'
          showInteractive={false}
        />
      </ReactFlow>

      <DaysAfterPopover
        open={!!popover && !!popoverEdge}
        anchor={popover?.anchor ?? null}
        onDismiss={dismissPopover}
        onDelete={() => {
          if (popover) removeEdge(popover.edgeId)
          dismissPopover()
        }}
      />

      <ConnectionPreview interaction={interaction} />
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
