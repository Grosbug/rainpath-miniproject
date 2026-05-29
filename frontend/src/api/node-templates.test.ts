import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  listNodeTemplates, createNodeTemplate, updateNodeTemplate, deleteNodeTemplate
} from './node-templates'
import { ApiError } from './client'

const originalFetch = globalThis.fetch

function mockFetchOnce(response: { status: number; body: unknown }) {
  globalThis.fetch = vi.fn().mockResolvedValueOnce(
    new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    })
  ) as unknown as typeof fetch
}

describe('node-templates api client', () => {
  beforeEach(() => { globalThis.fetch = originalFetch })

  it('listNodeTemplates parses the array', async () => {
    mockFetchOnce({
      status: 200,
      body: [{
        id: 't1', name: 'Email A',
        kind: 'send_email',
        params: { subject: 'Hi', body: '', output: { mode: 'simple', successCondition: { statuses: ['delivered'] } } },
        createdAt: '2026-05-28T10:00:00.000Z',
        updatedAt: '2026-05-28T10:00:00.000Z'
      }]
    })
    const list = await listNodeTemplates()
    expect(list).toHaveLength(1)
    expect(list[0]?.kind).toBe('send_email')
  })

  it('createNodeTemplate forwards body and parses response', async () => {
    mockFetchOnce({
      status: 201,
      body: {
        id: 't1', name: 'SMS short', kind: 'send_sms',
        params: { body: 'hi', output: { mode: 'simple', successCondition: { statuses: ['delivered'] } } },
        createdAt: '2026-05-28T10:00:00.000Z',
        updatedAt: '2026-05-28T10:00:00.000Z'
      }
    })
    const t = await createNodeTemplate({
      name: 'SMS short',
      kind: 'send_sms',
      params: { body: 'hi', output: { mode: 'simple', successCondition: { statuses: ['delivered'] } } }
    } as any)
    expect(t.id).toBe('t1')
  })

  it('updateNodeTemplate hits PATCH path', async () => {
    mockFetchOnce({
      status: 200,
      body: {
        id: 't1', name: 'renamed', kind: 'send_sms',
        params: { body: 'hi', output: { mode: 'simple', successCondition: { statuses: ['delivered'] } } },
        createdAt: '2026-05-28T10:00:00.000Z',
        updatedAt: '2026-05-28T10:00:00.000Z'
      }
    })
    const t = await updateNodeTemplate('t1', { name: 'renamed' })
    expect(t.name).toBe('renamed')
  })

  it('deleteNodeTemplate resolves on 204', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 })) as unknown as typeof fetch
    await expect(deleteNodeTemplate('t1')).resolves.toBeUndefined()
  })

  it('createNodeTemplate rejects with ApiError on 422', async () => {
    mockFetchOnce({
      status: 422,
      body: { statusCode: 422, errors: [{ code: 'bad', message: 'nope' }], warnings: [] }
    })
    let caught: unknown
    try {
      await createNodeTemplate({
        name: 'X', kind: 'send_email',
        params: { subject: '', body: '', output: { mode: 'simple', successCondition: { statuses: ['delivered'] } } }
      } as any)
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(ApiError)
    expect((caught as ApiError).status).toBe(422)
  })
})
