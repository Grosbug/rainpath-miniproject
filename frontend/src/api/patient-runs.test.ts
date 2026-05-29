import { describe, it, expect, beforeEach, vi } from 'vitest'
import { START_Y } from '@rainpath/shared'
import {
  listPatientRunsForWorkflow, getPatientRun, createPatientRun, advancePatientRun, resetPatientRun
} from './patient-runs'

const originalFetch = globalThis.fetch

function mockFetchOnce(response: { status: number; body: unknown }) {
  globalThis.fetch = vi.fn().mockResolvedValueOnce(
    new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    })
  ) as unknown as typeof fetch
}

const FULL_RUN = {
  id: 'r1',
  workflowId: 'w1',
  workflow: {
    id: 'w1', name: 'WF',
    graph: {
      nodes: [
        { id: 's', position: { x: 0, y: START_Y }, data: { kind: 'start' } },
        { id: 'e', position: { x: 30, y: START_Y }, data: { kind: 'end' } }
      ],
      edges: [{ id: 'e1', source: 's', target: 'e', daysAfter: 30 }]
    }
  },
  patient: {
    id: 'p1', firstName: 'Alice', lastName: 'Durand', name: 'Alice Durand', gender: 'female', postalCode: '75001',
    email: 'a@b.co', phone: null, whatsapp: null, address: null, deletedAt: null
  },
  currentNodeId: 's',
  history: [{ nodeId: 's', enteredAt: '2026-05-28T10:00:00.000Z' }],
  startDate: '2026-05-28T10:00:00.000Z',
  createdAt: '2026-05-28T10:00:00.000Z',
  updatedAt: '2026-05-28T10:00:00.000Z'
}

describe('patient-runs api client', () => {
  beforeEach(() => { globalThis.fetch = originalFetch })

  it('listPatientRunsForWorkflow parses the array', async () => {
    mockFetchOnce({
      status: 200,
      body: [{
        id: 'r1',
        patient: { id: 'p1', name: 'Alice Durand', deletedAt: null },
        currentNodeId: 's',
        startDate: '2026-05-28T10:00:00.000Z',
        updatedAt: '2026-05-28T10:00:00.000Z'
      }]
    })
    const list = await listPatientRunsForWorkflow('w1')
    expect(list).toHaveLength(1)
    expect(list[0]?.patient.name).toBe('Alice Durand')
  })

  it('getPatientRun parses the full run', async () => {
    mockFetchOnce({ status: 200, body: FULL_RUN })
    const run = await getPatientRun('r1')
    expect(run.workflow.graph.nodes).toHaveLength(2)
    expect(run.patient.name).toBe('Alice Durand')
  })

  it('createPatientRun POSTs to workflow path', async () => {
    mockFetchOnce({ status: 201, body: FULL_RUN })
    const run = await createPatientRun('w1', { patientId: 'p1' })
    expect(run.id).toBe('r1')
  })

  it('advancePatientRun POSTs to /advance', async () => {
    mockFetchOnce({ status: 201, body: FULL_RUN })
    const run = await advancePatientRun('r1', { outcome: 'opened' })
    expect(run.id).toBe('r1')
  })

  it('resetPatientRun POSTs to /reset', async () => {
    mockFetchOnce({ status: 201, body: FULL_RUN })
    const run = await resetPatientRun('r1')
    expect(run.id).toBe('r1')
  })
})
