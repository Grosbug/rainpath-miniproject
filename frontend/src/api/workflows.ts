import { z } from 'zod'
import {
  CreateWorkflowDto,
  DuplicateWorkflowDto,
  Graph,
  UpdateWorkflowDto
} from '@rainpath/shared'
import { ApiError, apiFetch } from './client'

// ---- Response schemas ----

const WorkflowSummary = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  updatedAt: z.string(),
  /** Backend-computed validity flag — gates "Démarrer un parcours" and the inline list
   *  badge. Optional so older API responses (or stale browser caches) don't blow up. */
  isValid: z.boolean().optional()
})
export type WorkflowSummary = z.infer<typeof WorkflowSummary>

const Warning = z.object({
  code: z.string(),
  message: z.string(),
  nodeId: z.string().optional(),
  edgeId: z.string().optional(),
  missingStatuses: z.array(z.string()).optional()
})

/**
 * Envelope schema for the workflow detail response — `graph` is parsed as `unknown`
 * here and re-validated with the shared `Graph` schema in `parseWorkflowDetail`.
 * Composing the shared `Graph` directly into this `z.object({...})` triggers TS2719
 * (dual-zod-instance type-identity mismatch).
 */
const WorkflowDetailEnvelope = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  graph: z.unknown(),
  createdAt: z.string(),
  updatedAt: z.string(),
  warnings: z.array(Warning).default([])
})

type EnvelopeRaw = z.infer<typeof WorkflowDetailEnvelope>
type GraphT = z.infer<typeof Graph>
export type WorkflowDetail = Omit<EnvelopeRaw, 'graph'> & { graph: GraphT }

function throwDrift(issues: z.ZodIssue[]): never {
  throw new ApiError(500, {
    message: 'response_drift',
    errors: issues.map(i => ({ code: 'response_drift', message: i.message, path: i.path }))
  })
}

function parseWorkflowDetail(raw: unknown): WorkflowDetail {
  const envR = WorkflowDetailEnvelope.safeParse(raw)
  if (!envR.success) throwDrift(envR.error.issues)
  const graphR = Graph.safeParse(envR.data.graph)
  if (!graphR.success) throwDrift(graphR.error.issues)
  return { ...envR.data, graph: graphR.data }
}

function parseList(raw: unknown): WorkflowSummary[] {
  const r = z.array(WorkflowSummary).safeParse(raw)
  if (!r.success) throwDrift(r.error.issues)
  return r.data
}

// ---- Methods ----

export async function listWorkflows(): Promise<WorkflowSummary[]> {
  const raw = await apiFetch<unknown>('/workflows')
  return parseList(raw)
}

export async function getWorkflow(id: string): Promise<WorkflowDetail> {
  const raw = await apiFetch<unknown>(`/workflows/${id}`)
  return parseWorkflowDetail(raw)
}

export async function createWorkflow(body: CreateWorkflowDto): Promise<WorkflowDetail> {
  const raw = await apiFetch<unknown>('/workflows', { method: 'POST', body })
  return parseWorkflowDetail(raw)
}

export async function updateWorkflow(id: string, body: UpdateWorkflowDto): Promise<WorkflowDetail> {
  const raw = await apiFetch<unknown>(`/workflows/${id}`, { method: 'PATCH', body })
  return parseWorkflowDetail(raw)
}

export async function duplicateWorkflow(id: string, body: DuplicateWorkflowDto): Promise<WorkflowDetail> {
  const raw = await apiFetch<unknown>(`/workflows/${id}/duplicate`, { method: 'POST', body })
  return parseWorkflowDetail(raw)
}

export async function deleteWorkflow(id: string): Promise<void> {
  await apiFetch<void>(`/workflows/${id}`, { method: 'DELETE' })
}
