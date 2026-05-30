import { describe, it, expect } from 'vitest'
import { prettifyLayout } from '../src/algorithms/prettify-layout'
import { START_Y } from '../src/constants'
import type { Graph } from '../src/schemas/primitives'

const start = (y = 200) => ({ id: 's', position: { x: 0, y }, data: { kind: 'start' as const } })
const end = (id: string, x = 0, y = 200) => ({ id, position: { x, y }, data: { kind: 'end' as const } })
const send = (id: string, x = 0, y = 200) => ({
  id, position: { x, y },
  data: { kind: 'send_email' as const, params: { subject: '', body: '', output: { mode: 'simple' as const, successCondition: { statuses: ['delivered'] } } } }
})
const edge = (id: string, source: string, target: string, daysAfter: number) =>
  ({ id, source, target, daysAfter })

describe('prettifyLayout', () => {
  it('preserves X (the temporal axis)', () => {
    const g: Graph = {
      nodes: [start(), send('a', 9999, 9999), end('e', 9999, 9999)],
      edges: [edge('e1', 's', 'a', 3), edge('e2', 'a', 'e', 4)]
    }
    const out = prettifyLayout(g)
    const xs = Object.fromEntries(out.nodes.map(n => [n.id, n.position.x]))
    expect(xs.s).toBe(0)
    expect(xs.a).toBe(3)
    expect(xs.e).toBe(7)
  })

  it('locks start at START_Y', () => {
    const g: Graph = {
      nodes: [start(50), send('a'), end('e')],
      edges: [edge('e1', 's', 'a', 1), edge('e2', 'a', 'e', 1)]
    }
    const out = prettifyLayout(g)
    const ys = Object.fromEntries(out.nodes.map(n => [n.id, n.position.y]))
    expect(ys.s).toBe(START_Y)
  })

  it('keeps Start anchored on the spine even on a tight linear chain', () => {
    // Tight chain (2-day delays) now triggers zigzag, but Start stays locked.
    const g: Graph = {
      nodes: [start(), send('a', 0, 600), end('e', 0, 12)],
      edges: [edge('e1', 's', 'a', 2), edge('e2', 'a', 'e', 2)]
    }
    const out = prettifyLayout(g)
    const ys = Object.fromEntries(out.nodes.map(n => [n.id, n.position.y]))
    expect(ys.s).toBe(START_Y)
  })

  it('preserves user-authored sibling order in fan-out / fan-in patterns', () => {
    // The constraint-based algorithm keeps the user's chosen Y order — it
    // does not try to minimise edge crossings.
    const g: Graph = {
      nodes: [
        start(),
        send('a', 0, 100),
        send('b', 0, 400),
        end('e')
      ],
      edges: [
        edge('e1', 's', 'a', 1),
        edge('e2', 's', 'b', 1),
        edge('e3', 'a', 'e', 1),
        edge('e4', 'b', 'e', 1)
      ]
    }
    const out = prettifyLayout(g)
    const y = (id: string) => out.nodes.find(n => n.id === id)!.position.y
    // Input had a above b; output must preserve that ordering.
    expect(y('a')).toBeLessThan(y('b'))
  })

  it('zigzags linear chains with tight day gaps so adjacent cards do not overlap', () => {
    // Pure linear chain start -> a -> b -> end with short delays (cards would
    // overlap horizontally at 28 px/day). The Y should alternate.
    const g: Graph = {
      nodes: [start(), send('a'), send('b'), end('e')],
      edges: [
        edge('e1', 's', 'a', 3),
        edge('e2', 'a', 'b', 3),
        edge('e3', 'b', 'e', 4)
      ]
    }
    const out = prettifyLayout(g)
    const ys = Object.fromEntries(out.nodes.map(n => [n.id, n.position.y]))
    expect(ys.s).toBe(START_Y)
    // a and b must be on different Y levels for their connecting edge to clear.
    expect(ys.a).not.toBe(ys.b)
    // At least one of the intermediate nodes is shifted off the spine.
    expect(ys.a !== START_Y || ys.b !== START_Y).toBe(true)
  })

  it('keeps a long-delay linear chain on the spine (no need to zigzag)', () => {
    // 30-day delays — cards are far apart horizontally, no overlap risk.
    const g: Graph = {
      nodes: [start(), send('a'), send('b'), end('e')],
      edges: [
        edge('e1', 's', 'a', 30),
        edge('e2', 'a', 'b', 30),
        edge('e3', 'b', 'e', 30)
      ]
    }
    const out = prettifyLayout(g)
    const ys = Object.fromEntries(out.nodes.map(n => [n.id, n.position.y]))
    expect(ys.s).toBe(START_Y)
    expect(ys.a).toBe(START_Y)
    expect(ys.b).toBe(START_Y)
    expect(ys.e).toBe(START_Y)
  })

  it('does not throw or change anything on empty graph', () => {
    const g: Graph = { nodes: [], edges: [] }
    expect(prettifyLayout(g)).toEqual(g)
  })

  it('Cascade multi-canal: no XY collisions, no same-Y in tight adjacent layers', () => {
    // Mirrors seed[0]: start -> email -> (success: end_ok | failure: sms -> ...) etc.
    const g: Graph = {
      nodes: [
        start(),
        send('email', 0, 200),
        send('sms', 0, 360),
        send('postal', 0, 520),
        end('end_ok', 0, 200),
        end('end_ko', 0, 520)
      ],
      edges: [
        edge('e_s_email', 's', 'email', 5),
        edge('e_email_ok', 'email', 'end_ok', 15),
        edge('e_email_sms', 'email', 'sms', 3),
        edge('e_sms_ok', 'sms', 'end_ok', 12),
        edge('e_sms_postal', 'sms', 'postal', 5),
        edge('e_postal_ok', 'postal', 'end_ok', 7),
        edge('e_postal_ko', 'postal', 'end_ko', 7)
      ]
    }
    const out = prettifyLayout(g)
    const ys = Object.fromEntries(out.nodes.map(n => [n.id, n.position.y]))
    expect(ys.s).toBe(START_Y)
    // No node within ±100px of a tight-adjacent-layer neighbour.
    const byX = new Map<number, typeof out.nodes>()
    for (const n of out.nodes) {
      const list = byX.get(n.position.x) ?? []
      list.push(n); byX.set(n.position.x, list)
    }
    const xs = [...byX.keys()].sort((a, b) => a - b)
    for (let i = 1; i < xs.length; i++) {
      if (xs[i]! - xs[i - 1]! > 10) continue
      for (const u of byX.get(xs[i - 1]!)!) {
        for (const v of byX.get(xs[i]!)!) {
          expect(Math.abs(u.position.y - v.position.y)).toBeGreaterThanOrEqual(100)
        }
      }
    }
  })

  it('moves a node off the path of an edge spanning its layer', () => {
    // Edge s -> e spans 3 days; node `mid` sits at day 1 with no own edges.
    // Without virtual-node handling, `mid` would land at Y=START_Y on top of
    // the edge line; with it, `mid` should be offset by at least GAP_Y.
    const g: Graph = {
      nodes: [
        start(),
        send('mid', 0, 200),
        end('e')
      ],
      edges: [
        edge('e1', 's', 'e', 3),
        edge('e2', 's', 'mid', 1),
        edge('e3', 'mid', 'e', 2)
      ]
    }
    const out = prettifyLayout(g)
    const ys = Object.fromEntries(out.nodes.map(n => [n.id, n.position.y]))
    // Start and End remain on the spine; `mid` is the third node at the middle
    // layer with the through-edge — it must not land on START_Y.
    expect(ys.s).toBe(START_Y)
    // mid should be offset from START_Y by at least ~GAP_Y/2 to leave room for the through edge.
    expect(Math.abs(ys.mid - START_Y)).toBeGreaterThanOrEqual(60)
  })

  it('bails out on cycles without throwing', () => {
    const g: Graph = {
      nodes: [start(), send('a'), send('b')],
      edges: [
        edge('e1', 's', 'a', 1),
        edge('e2', 'a', 'b', 1),
        edge('e3', 'b', 'a', 0)
      ]
    }
    expect(() => prettifyLayout(g)).not.toThrow()
  })
})
