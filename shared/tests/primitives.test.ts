import { describe, it, expect } from 'vitest'
import { Position, GraphEdge } from '../src/schemas/primitives'
import { START_Y } from '../src/constants'

describe('START_Y', () => {
  it('exports a constant of 200', () => {
    expect(START_Y).toBe(200)
  })
})

describe('Position', () => {
  it('parses valid coordinates', () => {
    expect(Position.parse({ x: 0, y: 200 })).toEqual({ x: 0, y: 200 })
  })
  it('rejects missing fields', () => {
    expect(() => Position.parse({ x: 0 })).toThrow()
  })
})

describe('GraphEdge', () => {
  it('parses a minimal edge', () => {
    expect(GraphEdge.parse({
      id: 'e1', source: 'n1', target: 'n2', daysAfter: 3
    })).toMatchObject({ id: 'e1', source: 'n1', target: 'n2', daysAfter: 3 })
  })
  it('accepts optional sourceHandle', () => {
    const e = GraphEdge.parse({
      id: 'e1', source: 'n1', target: 'n2', daysAfter: 0, sourceHandle: 'success'
    })
    expect(e.sourceHandle).toBe('success')
  })
  it('rejects negative daysAfter', () => {
    expect(() => GraphEdge.parse({
      id: 'e1', source: 'n1', target: 'n2', daysAfter: -1
    })).toThrow()
  })
  it('rejects non-integer daysAfter', () => {
    expect(() => GraphEdge.parse({
      id: 'e1', source: 'n1', target: 'n2', daysAfter: 1.5
    })).toThrow()
  })
})
