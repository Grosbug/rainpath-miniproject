import { describe, it, expect, beforeEach, vi } from 'vitest'
import { START_Y } from '@rainpath/shared'
import { listWorkflows, getWorkflow, createWorkflow } from './workflows'
import { ApiError } from './client'

const originalFetch = globalThis.fetch

function mockFetchOnce(response: { status: number; body: unknown; headers?: Record<string, string> }) {
  globalThis.fetch = vi.fn().mockResolvedValueOnce(
    new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { 'Content-Type': 'application/json', ...(response.headers ?? {}) }
    })
  ) as unknown as typeof fetch
}

describe('workflows api client', () => {
  beforeEach(() => { globalThis.fetch = originalFetch })

  it('listWorkflows() parses the array response', async () => {
    mockFetchOnce({
      status: 200,
      body: [{ id: 'w1', name: 'A', description: null, updatedAt: '2026-05-28T10:00:00.000Z' }]
    })
    const list = await listWorkflows()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ id: 'w1', name: 'A' })
  })

  it('getWorkflow(id) parses the full workflow including graph', async () => {
    const graph = {
      nodes: [
        { id: 's', position: { x: 0, y: START_Y }, data: { kind: 'start' } },
        { id: 'e', position: { x: 30, y: START_Y }, data: { kind: 'end' } }
      ],
      edges: [{ id: 'e1', source: 's', target: 'e', daysAfter: 30 }]
    }
    mockFetchOnce({
      status: 200,
      body: {
        id: 'w1',
        name: 'X',
        description: null,
        graph,
        createdAt: '2026-05-28T10:00:00.000Z',
        updatedAt: '2026-05-28T10:00:00.000Z',
        warnings: []
      }
    })
    const wf = await getWorkflow('w1')
    expect(wf.graph.nodes).toHaveLength(2)
    expect(wf.graph.edges[0]?.daysAfter).toBe(30)
  })

  it('createWorkflow() forwards body and parses response', async () => {
    mockFetchOnce({
      status: 201,
      body: {
        id: 'w1',
        name: 'New',
        description: null,
        graph: { nodes: [], edges: [] },
        createdAt: '2026-05-28T10:00:00.000Z',
        updatedAt: '2026-05-28T10:00:00.000Z',
        warnings: []
      }
    })
    const wf = await createWorkflow({ name: 'New' })
    expect(wf.name).toBe('New')
  })

  it('rejects with ApiError on a 422 response', async () => {
    mockFetchOnce({
      status: 422,
      body: { statusCode: 422, errors: [{ code: 'too_small', message: 'name required', path: ['name'] }], warnings: [] }
    })
    let caught: unknown
    try { await createWorkflow({ name: '' }) } catch (e) { caught = e }
    expect(caught).toBeInstanceOf(ApiError)
    expect((caught as ApiError).status).toBe(422)
    expect((caught as ApiError).body.errors?.[0]?.code).toBe('too_small')
  })
})
