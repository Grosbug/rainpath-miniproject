import { computeXPositions } from './compute-x-positions'
import { START_Y } from '../constants'
import type { Graph } from '../schemas/primitives'

const GAP_Y = 120
// Vertical clearance between two nodes in adjacent tight-X layers. Calibrated
// against the editor's geometry: card ≈ 80 px tall, edge label ≈ 22 px. The
// label sits at the bezier midpoint between the two cards' handles — to stay
// out of either card's body we need card_height + label_height ≈ 102 px of
// total Δy between card top-lefts. 120 leaves ~40 px of clear corridor for
// the label, which is enough for the rounded chip with comfortable margin.
// Each extra px compounds through chains so don't push higher without reason.
const MIN_INTERLAYER_CLEARANCE = 120
const TIGHT_DAYS = 10
const MIN_EDGE_PATH_CLEARANCE = 100
const END_SNAP_TOLERANCE = 60
const MAX_PASSES = 6

/**
 * Lightly rearrange the graph to remove visual conflicts, keeping the user's
 * authored layout as the starting point.
 *
 * X is canonical (`computeXPositions`) — temporal data is never touched.
 *
 * Y starts from the user's authored positions. Three constraints are then
 * enforced iteratively until stable (or 6 passes):
 *   - Within-layer: nodes at the same X stay ≥ GAP_Y apart.
 *   - Inter-layer: when two adjacent layers are close in X (≤ TIGHT_DAYS),
 *     nodes that would overlap horizontally are pushed apart vertically
 *     to give the connecting card-to-card edge clear room.
 *   - Edge-path: nodes sitting inside the interpolated path of a multi-layer
 *     edge are nudged off that path.
 *
 * Start is locked at START_Y; End snaps to START_Y when its Y is within ±half
 * a row, unless that would collapse the gap with its layer siblings.
 */
export function prettifyLayout(graph: Graph): Graph {
  if (graph.nodes.length === 0) return graph

  const existingX = new Map(graph.nodes.map(n => [n.id, n.position.x]))
  let xByNode: Map<string, number>
  try {
    xByNode = computeXPositions(graph, existingX)
  } catch {
    return graph
  }

  const y = new Map<string, number>(graph.nodes.map(n => [n.id, n.position.y]))
  const kindById = new Map(graph.nodes.map(n => [n.id, n.data.kind]))

  const startNode = graph.nodes.find(n => n.data.kind === 'start')
  if (startNode) y.set(startNode.id, START_Y)

  const layerMap = new Map<number, string[]>()
  for (const n of graph.nodes) {
    const xv = xByNode.get(n.id) ?? n.position.x
    const arr = layerMap.get(xv)
    if (arr) arr.push(n.id)
    else layerMap.set(xv, [n.id])
  }
  const layerXs = [...layerMap.keys()].sort((a, b) => a - b)
  const layers = layerXs.map(xv => layerMap.get(xv)!.slice())

  const children = new Map<string, string[]>()
  for (const n of graph.nodes) children.set(n.id, [])
  for (const e of graph.edges) children.get(e.source)?.push(e.target)

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let changed = false

    // 1. Within-layer spacing.
    for (const layer of layers) {
      if (layer.length < 2) continue
      const sorted = layer.slice().sort((a, b) => (y.get(a) ?? 0) - (y.get(b) ?? 0))
      for (let i = 1; i < sorted.length; i++) {
        const prevY = y.get(sorted[i - 1]!)!
        const currY = y.get(sorted[i]!)!
        if (currY - prevY < GAP_Y) {
          y.set(sorted[i]!, prevY + GAP_Y)
          changed = true
        }
      }
    }

    // 2. Inter-layer vertical clearance for tight horizontal gaps.
    for (let li = 1; li < layers.length; li++) {
      for (const id of layers[li]!) {
        if (kindById.get(id) === 'start') continue
        const cx = xByNode.get(id) ?? 0
        const cy = y.get(id) ?? START_Y
        for (const pid of layers[li - 1]!) {
          const px = xByNode.get(pid) ?? 0
          if (cx - px > TIGHT_DAYS) continue
          const py = y.get(pid) ?? START_Y
          const dy = cy - py
          if (Math.abs(dy) >= MIN_INTERLAYER_CLEARANCE) continue
          let direction: number
          if (dy !== 0) {
            direction = dy > 0 ? 1 : -1
          } else {
            // Tie (cy === py). Pick the direction that keeps the graph
            // compact — toward the overall centroid of already-positioned
            // nodes, falling back to children's mean if no useful centroid.
            const childYs = (children.get(id) ?? []).map(c => y.get(c) ?? START_Y)
            if (childYs.length > 0) {
              const childMean = childYs.reduce((a, b) => a + b, 0) / childYs.length
              direction = childMean >= py ? 1 : -1
            } else {
              const allYs = graph.nodes.map(n => y.get(n.id) ?? START_Y)
              const centroid = allYs.reduce((a, b) => a + b, 0) / allYs.length
              direction = centroid >= py ? 1 : -1
            }
          }
          y.set(id, py + direction * MIN_INTERLAYER_CLEARANCE)
          changed = true
          break
        }
      }
    }

    // 3. Edge-path clearance: shift nodes lying inside the interpolated Y
    //    track of a multi-layer edge.
    for (const e of graph.edges) {
      const sx = xByNode.get(e.source) ?? 0
      const tx = xByNode.get(e.target) ?? 0
      if (tx - sx <= 1) continue
      const sy = y.get(e.source) ?? START_Y
      const ty = y.get(e.target) ?? START_Y
      for (let li = 0; li < layers.length; li++) {
        const lx = layerXs[li]!
        if (lx <= sx || lx >= tx) continue
        const edgeY = sy + (ty - sy) * ((lx - sx) / (tx - sx))
        for (const id of layers[li]!) {
          if (id === e.source || id === e.target) continue
          if (kindById.get(id) === 'start') continue
          const cy = y.get(id) ?? START_Y
          if (Math.abs(cy - edgeY) >= MIN_EDGE_PATH_CLEARANCE) continue
          const direction = cy >= edgeY ? 1 : -1
          y.set(id, edgeY + direction * MIN_EDGE_PATH_CLEARANCE)
          changed = true
        }
      }
    }

    // 4. Re-lock Start.
    if (startNode) y.set(startNode.id, START_Y)

    if (!changed) break
  }

  // End-snap: only when it doesn't break within-layer spacing.
  const endNode = graph.nodes.find(n => n.data.kind === 'end')
  if (endNode) {
    const cy = y.get(endNode.id) ?? START_Y
    if (Math.abs(cy - START_Y) <= END_SNAP_TOLERANCE) {
      const ex = xByNode.get(endNode.id)
      const sibYs = graph.nodes
        .filter(n => n.id !== endNode.id && xByNode.get(n.id) === ex)
        .map(n => y.get(n.id) ?? START_Y)
      const conflict = sibYs.some(sy => Math.abs(sy - START_Y) < GAP_Y)
      if (!conflict) y.set(endNode.id, START_Y)
    }
  }

  return {
    nodes: graph.nodes.map(n => ({
      ...n,
      position: {
        x: xByNode.get(n.id) ?? n.position.x,
        y: y.get(n.id) ?? n.position.y
      }
    })),
    edges: graph.edges
  }
}
