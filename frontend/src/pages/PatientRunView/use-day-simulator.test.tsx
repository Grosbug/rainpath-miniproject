import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { START_Y, type Graph } from '@rainpath/shared'
import { useDaySimulator } from './use-day-simulator'
import * as patientRunsApi from '@/api/patient-runs'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() }
}))

vi.mock('@/api/patient-runs', () => ({
  advancePatientRun: vi.fn(),
  resetPatientRun: vi.fn()
}))

function wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const PROFILE = { email: 'a@b.fr', phone: null, whatsapp: null, address: null }

/** Simple graph: start → email → end, daysAfter [2, 3] → email at J+2, end at J+5. */
function simpleEmailGraph(): Graph {
  return {
    nodes: [
      { id: 's', position: { x: 0, y: START_Y }, data: { kind: 'start' } },
      {
        id: 'm',
        position: { x: 2, y: START_Y },
        data: {
          kind: 'send_email',
          params: {
            subject: 'sub',
            body: 'body',
            output: { mode: 'simple', successCondition: { statuses: ['delivered', 'opened', 'clicked', 'unopened'] } }
          }
        }
      },
      { id: 'e', position: { x: 5, y: START_Y }, data: { kind: 'end' } }
    ],
    edges: [
      { id: 'e1', source: 's', target: 'm', daysAfter: 2 },
      { id: 'e2', source: 'm', target: 'e', daysAfter: 3, sourceHandle: 'success' },
      { id: 'e3', source: 'm', target: 'e', daysAfter: 1, sourceHandle: 'failure' }
    ]
  }
}

const baseArgs = (overrides: Partial<Parameters<typeof useDaySimulator>[0]> = {}) => ({
  runId: 'run-1',
  workflowId: 'wf-1',
  graph: simpleEmailGraph(),
  focusedNodeId: 's' as string | null,
  activeFrontiers: [] as readonly string[],
  actionableNodeIds: ['s'] as readonly string[],
  history: [{ nodeId: 's' }] as Array<{ nodeId: string; outcome?: string }>,
  profile: PROFILE,
  ...overrides
})

beforeEach(() => {
  vi.mocked(patientRunsApi.advancePatientRun).mockReset()
  vi.mocked(patientRunsApi.resetPatientRun).mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useDaySimulator', () => {
  it('reports day = 0 and start as the current node when focused on Start', () => {
    const { result } = renderHook(() => useDaySimulator(baseArgs()), { wrapper })
    expect(result.current.day).toBe(0)
    expect(result.current.currentNodeIds).toEqual(['s'])
    expect(result.current.pauseReason).toBeNull()
  })

  it('reports the cumulative J+N day when focused on a downstream send node', () => {
    const { result } = renderHook(() =>
      useDaySimulator(baseArgs({
        focusedNodeId: 'm',
        activeFrontiers: ['m'],
        actionableNodeIds: ['m'],
        history: [{ nodeId: 's', outcome: undefined }]
      })), { wrapper })
    expect(result.current.day).toBe(2)
    expect(result.current.currentNodeIds).toEqual(['m'])
    expect(result.current.pauseReason).toBe('awaiting_status')
  })

  it('flags pauseReason = "end" when the focused node is end and no frontier remains', () => {
    const { result } = renderHook(() =>
      useDaySimulator(baseArgs({
        focusedNodeId: 'e',
        activeFrontiers: [],
        actionableNodeIds: [],
        history: [{ nodeId: 's' }, { nodeId: 'm', outcome: 'delivered' }, { nodeId: 'e' }]
      })), { wrapper })
    expect(result.current.pauseReason).toBe('end')
    expect(result.current.currentNodeIds).toEqual([])
  })

  it('setPending stages a status; allCurrentsHaveStatus flips true once every current has a pick', () => {
    const { result } = renderHook(() =>
      useDaySimulator(baseArgs({
        focusedNodeId: 'm',
        activeFrontiers: ['m'],
        actionableNodeIds: ['m'],
        history: [{ nodeId: 's', outcome: undefined }]
      })), { wrapper })
    expect(result.current.allCurrentsHaveStatus).toBe(false)
    expect(result.current.anyCurrentMissingStatus).toBe(true)

    act(() => result.current.setPending('m', 'delivered'))
    expect(result.current.allCurrentsHaveStatus).toBe(true)
    expect(result.current.anyCurrentMissingStatus).toBe(false)
    expect(result.current.pendingByNode.m).toBe('delivered')
  })

  it('canReset is false on a fresh run and true once any node beyond start is in history', () => {
    const fresh = renderHook(() => useDaySimulator(baseArgs()), { wrapper })
    expect(fresh.result.current.canReset).toBe(false)

    const advanced = renderHook(() =>
      useDaySimulator(baseArgs({
        history: [{ nodeId: 's' }, { nodeId: 'm' }]
      })), { wrapper })
    expect(advanced.result.current.canReset).toBe(true)
  })

  it('advanceAllPending() returns false and does not call the API when no status is staged for a send_*', async () => {
    const { result } = renderHook(() =>
      useDaySimulator(baseArgs({
        focusedNodeId: 'm',
        activeFrontiers: ['m'],
        actionableNodeIds: ['m'],
        history: [{ nodeId: 's' }]
      })), { wrapper })

    const success = await act(() => result.current.advanceAllPending())
    expect(success).toBe(false)
    expect(patientRunsApi.advancePatientRun).not.toHaveBeenCalled()
  })

  it('advanceAllPending() walks Start without a status, then stops at the next send_*', async () => {
    // Mock advance to return a run focused on the next node (m), with end-of-chain.
    vi.mocked(patientRunsApi.advancePatientRun).mockResolvedValueOnce({
      focusedNodeId: 'm'
    } as Awaited<ReturnType<typeof patientRunsApi.advancePatientRun>>)

    const { result } = renderHook(() => useDaySimulator(baseArgs()), { wrapper })

    const success = await act(() => result.current.advanceAllPending())
    expect(success).toBe(true)
    expect(patientRunsApi.advancePatientRun).toHaveBeenCalledTimes(1)
    expect(patientRunsApi.advancePatientRun).toHaveBeenCalledWith('run-1', { nodeId: 's' })
  })

  it('advanceAllPending() fires the staged status for a send_* and stops when the next focus needs another pick', async () => {
    vi.mocked(patientRunsApi.advancePatientRun).mockResolvedValueOnce({
      focusedNodeId: 'e'
    } as Awaited<ReturnType<typeof patientRunsApi.advancePatientRun>>)

    const { result } = renderHook(() =>
      useDaySimulator(baseArgs({
        focusedNodeId: 'm',
        activeFrontiers: ['m'],
        actionableNodeIds: ['m'],
        history: [{ nodeId: 's' }]
      })), { wrapper })

    act(() => result.current.setPending('m', 'delivered'))
    const ok = await act(() => result.current.advanceAllPending())
    expect(ok).toBe(true)
    expect(patientRunsApi.advancePatientRun).toHaveBeenCalledWith('run-1', { nodeId: 'm', outcome: 'delivered' })
  })

  it('resetRun() invokes resetPatientRun and clears pendingByNode', async () => {
    vi.mocked(patientRunsApi.resetPatientRun).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof patientRunsApi.resetPatientRun>>
    )

    const { result } = renderHook(() =>
      useDaySimulator(baseArgs({
        focusedNodeId: 'm',
        activeFrontiers: ['m'],
        actionableNodeIds: ['m'],
        history: [{ nodeId: 's' }]
      })), { wrapper })

    act(() => result.current.setPending('m', 'delivered'))
    expect(result.current.pendingByNode.m).toBe('delivered')

    await act(() => result.current.resetRun())
    await waitFor(() => {
      expect(patientRunsApi.resetPatientRun).toHaveBeenCalledWith('run-1')
    })
    expect(result.current.pendingByNode.m).toBeUndefined()
  })
})
