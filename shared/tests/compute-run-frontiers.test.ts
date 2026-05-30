import { describe, it, expect } from 'vitest'
import {
  chronoEarliestActionableNodeId,
  computeActiveFrontiers,
  nodeRunAction,
  nodeScheduledDay,
  resolveFocusedNodeId,
  runDayAtNode
} from '../src/algorithms/compute-run-frontiers'
import type { Graph } from '../src/schemas/primitives'

const start = { id: 's', position: { x: 0, y: 200 }, data: { kind: 'start' as const } }
const email = (id: string, x: number) => ({
  id, position: { x, y: 200 },
  data: {
    kind: 'send_email' as const,
    params: { subject: '', body: '', output: { mode: 'simple', successCondition: { statuses: ['delivered'] } } }
  }
})
const end = (id: string, x: number) => ({ id, position: { x, y: 200 }, data: { kind: 'end' as const } })
const edge = (id: string, source: string, target: string, daysAfter = 1, sourceHandle?: string) =>
  ({ id, source, target, daysAfter, sourceHandle })

describe('computeActiveFrontiers', () => {
  it('opens parallel children at the same J day after start is visited', () => {
    const g: Graph = {
      nodes: [start, email('a', 7), email('b', 7), end('e', 14)],
      edges: [
        edge('e1', 's', 'a', 7),
        edge('e2', 's', 'b', 7),
        edge('e3', 'a', 'e', 7, 'success'),
        edge('e4', 'b', 'e', 7, 'success')
      ]
    }
    const f = computeActiveFrontiers(g, [{ nodeId: 's' }])
    expect(f).toEqual(['a', 'b'])
    expect(nodeScheduledDay(g, 'a')).toBe(7)
  })

  it('does not open the join target until every incoming branch has recorded an outcome', () => {
    // A join target opens only once every incoming branch has recorded its
    // outcome (= source-side exit). Entering a sibling without an outcome
    // keeps the join target gated — otherwise interleaved parallel branches
    // would race the canvas into showing a downstream node that no source
    // actually fed yet.
    const g: Graph = {
      nodes: [start, email('a', 7), email('b', 7), end('e', 14)],
      edges: [
        edge('e1', 's', 'a', 7),
        edge('e2', 's', 'b', 7),
        edge('e3', 'a', 'e', 7, 'success'),
        edge('e4', 'b', 'e', 7, 'success')
      ]
    }
    // Only a entered (no outcome yet): the other J+7 sibling b is still open,
    // the J+14 join target e stays closed.
    const f = computeActiveFrontiers(g, [{ nodeId: 's' }, { nodeId: 'a' }])
    expect(f).toEqual(['b'])
    // Both a and b entered but no outcomes: e is still gated.
    const fEntered = computeActiveFrontiers(g, [{ nodeId: 's' }, { nodeId: 'a' }, { nodeId: 'b' }])
    expect(fEntered).toEqual([])
    // Both a and b recorded their outcomes — now e is open.
    const fExited = computeActiveFrontiers(g, [
      { nodeId: 's' },
      { nodeId: 'a', outcome: 'delivered' },
      { nodeId: 'b', outcome: 'delivered' }
    ])
    expect(fExited).toEqual(['e'])
  })
})

describe('nodeRunAction', () => {
  it('distinguishes enter vs leave', () => {
    const g: Graph = {
      nodes: [start, email('a', 7)],
      edges: [edge('e1', 's', 'a', 7)]
    }
    const hist = [{ nodeId: 's' }]
    const f = computeActiveFrontiers(g, hist)
    expect(nodeRunAction(g, hist, f, 'a')).toBe('enter')
    expect(nodeRunAction(g, hist, f, 's')).toBe('leave')
  })
})

describe('resolveFocusedNodeId', () => {
  it('keeps stored focus when still valid', () => {
    const g: Graph = {
      nodes: [start, email('a', 7), email('b', 7)],
      edges: [edge('e1', 's', 'a', 7), edge('e2', 's', 'b', 7)]
    }
    const hist = [{ nodeId: 's' }]
    const f = computeActiveFrontiers(g, hist)
    expect(resolveFocusedNodeId(g, hist, f, 'b')).toBe('b')
  })

  it('falls back to the chronologically earliest actionable node, not the last history entry', () => {
    // Two parallel branches: A at J+3 (earlier), B at J+5 (later). User visited
    // B first (manual override since stored focus is now cleared). With null
    // stored focus, the fallback should pull to A (chrono-earliest), not B.
    const g: Graph = {
      nodes: [start, email('a', 3), email('b', 5)],
      edges: [edge('e1', 's', 'a', 3), edge('e2', 's', 'b', 5)]
    }
    const hist = [{ nodeId: 's' }, { nodeId: 'b' }]
    const f = computeActiveFrontiers(g, hist)
    expect(f).toEqual(['a'])
    expect(resolveFocusedNodeId(g, hist, f, null)).toBe('a')
  })
})

describe('runDayAtNode', () => {
  it('returns the cumulative day when the node is in history', () => {
    const g: Graph = {
      nodes: [start, email('a', 7), email('b', 14)],
      edges: [edge('e1', 's', 'a', 7), edge('e2', 'a', 'b', 7, 'success')]
    }
    const hist = [
      { nodeId: 's' },
      { nodeId: 'a' },
      { nodeId: 'b', outcome: 'delivered' }
    ]
    expect(runDayAtNode(g, hist, 'a')).toBe(7)
    expect(runDayAtNode(g, hist, 'b')).toBe(14)
  })

  it('projects an unvisited frontier from its visited predecessor', () => {
    const g: Graph = {
      nodes: [start, email('a', 3), email('b', 5)],
      edges: [edge('e1', 's', 'a', 3), edge('e2', 's', 'b', 5)]
    }
    const hist = [{ nodeId: 's' }]
    expect(runDayAtNode(g, hist, 'a')).toBe(3)
    expect(runDayAtNode(g, hist, 'b')).toBe(5)
  })

  it('disambiguates between success and failure edges with the same target', () => {
    // Two edges from `a` to `b` — one on the success handle (daysAfter=2),
    // one on the failure handle (daysAfter=10). Pick by transition outcome.
    const g: Graph = {
      nodes: [start, email('a', 0), email('b', 0)],
      edges: [
        edge('e1', 's', 'a', 0),
        edge('e2', 'a', 'b', 2, 'success'),
        edge('e3', 'a', 'b', 10, 'failure')
      ]
    }
    const histSuccess = [{ nodeId: 's' }, { nodeId: 'a' }, { nodeId: 'b', outcome: 'delivered' }]
    expect(runDayAtNode(g, histSuccess, 'b')).toBe(2)
    const histFailure = [{ nodeId: 's' }, { nodeId: 'a' }, { nodeId: 'b', outcome: 'bounced' }]
    expect(runDayAtNode(g, histFailure, 'b')).toBe(10)
  })
})

describe('computeActiveFrontiers — runtime gating', () => {
  it('gates on real cumulative day, not the editor layout X', () => {
    // Branch A: edge daysAfter=3, but node positioned at x=20 (layout drift).
    // Branch B: edge daysAfter=5, node positioned at x=5.
    // Layout-X gate would have opened B first (smaller x). Runtime gate must
    // open A first because its real entry day (3) < B's (5).
    const g: Graph = {
      nodes: [start, email('a', 20), email('b', 5)],
      edges: [edge('e1', 's', 'a', 3), edge('e2', 's', 'b', 5)]
    }
    const f = computeActiveFrontiers(g, [{ nodeId: 's' }])
    expect(f).toEqual(['a'])
  })
})

describe('chronoEarliestActionableNodeId', () => {
  it('prefers a visited leave-pending node over a same-day frontier (stay on the card the user just opened)', () => {
    // Both A and B are J+3 from start. After entering A, A is leave-pending at
    // J+3 and B is still enter-pending at J+3. Tie → leave wins so the focus
    // stays on A for its outcome instead of jumping the picker onto B.
    const g: Graph = {
      nodes: [start, email('a', 3), email('b', 3), end('e', 10)],
      edges: [
        edge('e1', 's', 'a', 3),
        edge('e2', 's', 'b', 3),
        edge('e3', 'a', 'e', 7, 'success'),
        edge('e4', 'b', 'e', 7, 'success')
      ]
    }
    const hist = [{ nodeId: 's' }, { nodeId: 'a' }]
    const f = computeActiveFrontiers(g, hist)
    expect(f).toEqual(['b'])
    expect(chronoEarliestActionableNodeId(g, hist, f)).toBe('a')
  })

  it('picks the smaller-day leave-pending node over a later-day parallel frontier', () => {
    // B is leave-pending at J+3 (just entered, no outcome yet); C is a parallel
    // frontier reachable from Start at J+10. Chrono-earliest must pick B
    // (J+3) over C (J+10) — the auto-pilot finishes the current branch tier
    // before jumping to a later sibling.
    const g: Graph = {
      nodes: [start, email('b', 3), email('c', 10)],
      edges: [
        edge('e1', 's', 'b', 3),
        edge('e2', 's', 'c', 10)
      ]
    }
    const hist = [{ nodeId: 's' }, { nodeId: 'b' }]
    const f = computeActiveFrontiers(g, hist)
    expect(f).toEqual(['c'])
    expect(chronoEarliestActionableNodeId(g, hist, f)).toBe('b')
  })

  it('returns null when nothing is actionable (run finished)', () => {
    const g: Graph = {
      nodes: [start, email('a', 3), end('e', 10)],
      edges: [edge('e1', 's', 'a', 3), edge('e2', 'a', 'e', 7, 'success')]
    }
    const hist = [
      { nodeId: 's' },
      { nodeId: 'a' },
      { nodeId: 'e', outcome: 'delivered' }
    ]
    const f = computeActiveFrontiers(g, hist)
    expect(chronoEarliestActionableNodeId(g, hist, f)).toBeNull()
  })
})
