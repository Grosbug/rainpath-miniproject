import { z } from 'zod'
import type { AdvancePatientRunDto, CreatePatientRunDto, Graph } from '@rainpath/shared'
import { Graph as GraphSchema } from '@rainpath/shared'
import { ApiError, apiFetch } from './client'

const HistoryEntry = z.object({
  nodeId: z.string(),
  enteredAt: z.string(),
  outcome: z.string().optional()
})
export type RunHistoryEntry = z.infer<typeof HistoryEntry>

const PatientRunSummary = z.object({
  id: z.string(),
  patient: z.object({
    id: z.string(),
    name: z.string(),
    deletedAt: z.string().nullable()
  }),
  currentNodeId: z.string().nullable(),
  updatedAt: z.string()
})
export type PatientRunSummary = z.infer<typeof PatientRunSummary>

const FullRunEnvelope = z.object({
  id: z.string(),
  workflowId: z.string(),
  workflow: z.object({
    id: z.string(),
    name: z.string(),
    graph: z.unknown()
  }),
  patient: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    whatsapp: z.string().nullable(),
    address: z.string().nullable(),
    deletedAt: z.string().nullable()
  }),
  currentNodeId: z.string().nullable(),
  history: z.array(HistoryEntry),
  createdAt: z.string(),
  updatedAt: z.string()
})

type EnvelopeRaw = z.infer<typeof FullRunEnvelope>
export type PatientRunFull = Omit<EnvelopeRaw, 'workflow'> & {
  workflow: { id: string; name: string; graph: Graph }
}

function throwDrift(issues: z.ZodIssue[]): never {
  throw new ApiError(500, {
    message: 'response_drift',
    errors: issues.map(i => ({ code: 'response_drift', message: i.message, path: i.path }))
  })
}

function parseRun(raw: unknown): PatientRunFull {
  const envR = FullRunEnvelope.safeParse(raw)
  if (!envR.success) throwDrift(envR.error.issues)
  const graphR = GraphSchema.safeParse(envR.data.workflow.graph)
  if (!graphR.success) throwDrift(graphR.error.issues)
  return {
    ...envR.data,
    workflow: { id: envR.data.workflow.id, name: envR.data.workflow.name, graph: graphR.data }
  }
}

function parseList(raw: unknown): PatientRunSummary[] {
  const r = z.array(PatientRunSummary).safeParse(raw)
  if (!r.success) throwDrift(r.error.issues)
  return r.data
}

export async function listPatientRunsForWorkflow(workflowId: string): Promise<PatientRunSummary[]> {
  const raw = await apiFetch<unknown>(`/workflows/${workflowId}/patient-runs`)
  return parseList(raw)
}

export async function getPatientRun(id: string): Promise<PatientRunFull> {
  const raw = await apiFetch<unknown>(`/patient-runs/${id}`)
  return parseRun(raw)
}

export async function createPatientRun(workflowId: string, body: CreatePatientRunDto): Promise<PatientRunFull> {
  const raw = await apiFetch<unknown>(`/workflows/${workflowId}/patient-runs`, { method: 'POST', body })
  return parseRun(raw)
}

export async function advancePatientRun(id: string, body: AdvancePatientRunDto): Promise<PatientRunFull> {
  const raw = await apiFetch<unknown>(`/patient-runs/${id}/advance`, { method: 'POST', body })
  return parseRun(raw)
}

export async function resetPatientRun(id: string): Promise<PatientRunFull> {
  const raw = await apiFetch<unknown>(`/patient-runs/${id}/reset`, { method: 'POST' })
  return parseRun(raw)
}
