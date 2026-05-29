import { describe, it, expect, beforeEach, vi } from 'vitest'
import { listPatientProfiles, createPatientProfile, updatePatientProfile, deletePatientProfile } from './patient-profiles'
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

describe('patient-profiles api client', () => {
  beforeEach(() => { globalThis.fetch = originalFetch })

  it('listPatientProfiles parses the array', async () => {
    mockFetchOnce({
      status: 200,
      body: [{
        id: 'p1', firstName: 'Alice', lastName: 'Doe', name: 'Alice Doe', gender: 'female', postalCode: '75001',
        email: 'a@b.co', phone: null, whatsapp: null, address: null,
        createdAt: '2026-05-28T10:00:00.000Z', updatedAt: '2026-05-28T10:00:00.000Z', deletedAt: null
      }]
    })
    const list = await listPatientProfiles()
    expect(list).toHaveLength(1)
    expect(list[0]?.firstName).toBe('Alice')
  })

  it('createPatientProfile forwards body', async () => {
    mockFetchOnce({
      status: 201,
      body: {
        id: 'p1', firstName: 'Bob', lastName: 'Smith', name: 'Bob Smith', gender: 'male', postalCode: '75001',
        email: null, phone: null, whatsapp: null, address: null,
        createdAt: '2026-05-28T10:00:00.000Z', updatedAt: '2026-05-28T10:00:00.000Z', deletedAt: null
      }
    })
    const p = await createPatientProfile({ firstName: 'Bob', lastName: 'Test', gender: 'male' })
    expect(p.id).toBe('p1')
  })

  it('updatePatientProfile uses PATCH', async () => {
    mockFetchOnce({
      status: 200,
      body: {
        id: 'p1', firstName: 'Bob', lastName: 'Smith', name: 'Bob Smith', gender: 'male', postalCode: '75001',
        email: null, phone: '+33', whatsapp: null, address: null,
        createdAt: '2026-05-28T10:00:00.000Z', updatedAt: '2026-05-28T10:00:00.000Z', deletedAt: null
      }
    })
    const p = await updatePatientProfile('p1', { phone: '+33' })
    expect(p.phone).toBe('+33')
  })

  it('deletePatientProfile resolves on 204', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 })) as unknown as typeof fetch
    await expect(deletePatientProfile('p1')).resolves.toBeUndefined()
  })

  it('createPatientProfile rejects with ApiError on 422', async () => {
    mockFetchOnce({
      status: 422,
      body: { statusCode: 422, errors: [{ code: 'too_small', message: 'name required' }], warnings: [] }
    })
    let caught: unknown
    try { await createPatientProfile({ firstName: '', lastName: '', gender: 'male' }) } catch (e) { caught = e }
    expect(caught).toBeInstanceOf(ApiError)
  })
})
