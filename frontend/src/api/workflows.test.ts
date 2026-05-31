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

  it('listWorkflows() parses the paginated envelope', async () => {
    mockFetchOnce({
      status: 200,
      body: {
        items: [{ id: 'w1', name: 'A', description: null, updatedAt: '2026-05-28T10:00:00.000Z', isValid: true }],
        total: 1,
        limit: 50,
        offset: 0
      }
    })
    const list = await listWorkflows()
    expect(list.items).toHaveLength(1)
    expect(list.total).toBe(1)
    expect(list.items[0]).toMatchObject({ id: 'w1', name: 'A', isValid: true })
  })

  it('listWorkflows({ limit, offset, search }) forwards as query string', async () => {
    const spy = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [], total: 0, limit: 10, offset: 20 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )
    globalThis.fetch = spy as unknown as typeof fetch
    await listWorkflows({ limit: 10, offset: 20, search: 'relance' })
    const url = String(spy.mock.calls[0]?.[0])
    expect(url).toContain('limit=10')
    expect(url).toContain('offset=20')
    expect(url).toContain('search=relance')
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
