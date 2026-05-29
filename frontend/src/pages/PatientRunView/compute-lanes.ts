import type { Graph } from '@rainpath/shared'

/**
 * Sort key for outgoing edges so the "main" branch keeps the parent lane:
 *   0 = success / true (happy path stays on rail)
 *   1 = unnamed / multi-output custom handles
 *   2 = failure / false (alternate branches drop below)
 */
function handleRank(h: string | undefined): number {
  if (h === 'success' || h === 'true') return 0
  if (h === 'failure' || h === 'false') return 2
  return 1
}

/**
 * Assign each node to a horizontal lane (0 = top rail) so the patient canvas
 * reads as a linear timeline of branches rather than a free-form editor scatter.
 *
 * Strategy: BFS from start. A node's first outgoing edge keeps the parent's
 * lane; siblings move to the next free lane at the target's X (day) column.
 * Cells along the edge span are reserved too, so a sibling branch never
 * crosses an edge belonging to another lane.
 */
export function computeLanes(graph: Graph): Map<string, number> {
  const lanes = new Map<string, number>()
  const start = graph.nodes.find(n => n.data.kind === 'start')
  if (!start) {
    for (const n of graph.nodes) lanes.set(n.id, 0)
    return lanes
  }

  const xOf = new Map<string, number>(
    graph.nodes.map(n => [n.id, Math.max(0, Math.round(n.position.x))])
  )
  const occupiedAt = new Map<number, Set<number>>()

  function isFree(x: number, lane: number): boolean {
    return !(occupiedAt.get(x)?.has(lane) ?? false)
  }
  function reserveCell(x: number, lane: number) {
    let set = occupiedAt.get(x)
    if (!set) { set = new Set(); occupiedAt.set(x, set) }
    set.add(lane)
  }
  function reserveSpan(fromX: number, toX: number, lane: number) {
    const lo = Math.min(fromX, toX)
    const hi = Math.max(fromX, toX)
    for (let x = lo; x <= hi; x++) reserveCell(x, lane)
  }
  function nextFreeLane(x: number, preferred: number): number {
    if (isFree(x, preferred)) return preferred
    let l = 0
    while (!isFree(x, l)) l++
    return l
  }

  lanes.set(start.id, 0)
  reserveCell(xOf.get(start.id) ?? 0, 0)

  const queue: { id: string; lane: number }[] = [{ id: start.id, lane: 0 }]
  while (queue.length > 0) {
    const { id, lane } = queue.shift()!
    const sourceX = xOf.get(id) ?? 0
    const outs = graph.edges
      .filter(e => e.source === id)
      .sort((a, b) => handleRank(a.sourceHandle) - handleRank(b.sourceHandle))

    outs.forEach((e, i) => {
      if (lanes.has(e.target)) return
      const targetX = xOf.get(e.target) ?? 0
      const preferred = i === 0 ? lane : lane + 1
      const chosen = nextFreeLane(targetX, preferred)
      lanes.set(e.target, chosen)
      reserveSpan(sourceX, targetX, chosen)
      queue.push({ id: e.target, lane: chosen })
    })
  }

  // Orphan nodes (not reachable from start) get their own rails below the
  // connected component so they don't overlap the live chain. Each one on its
  // own lane is intentional — they're already faded, no need to pack them.
  let nextOrphanLane = 0
  for (const lane of lanes.values()) {
    if (lane >= nextOrphanLane) nextOrphanLane = lane + 1
  }
  for (const n of graph.nodes) {
    if (!lanes.has(n.id)) lanes.set(n.id, nextOrphanLane++)
  }
  return lanes
}
