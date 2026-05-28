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
  updatedAt: z.string()
})
export type WorkflowSummary = z.infer<typeof WorkflowSummary>

const Warning = z.object({
  code: z.string(),
  message: z.string(),
  nodeId: z.string().optional(),
  edgeId: z.string().optional(),
  missingStatuses: z.array(z.string()).optional()
})

const WorkflowDetail = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  graph: Graph,
  createdAt: z.string(),
  updatedAt: z.string(),
  warnings: z.array(Warning)
})
export type WorkflowDetail = z.infer<typeof WorkflowDetail>

function parseOrThrow<T>(schema: z.ZodSchema<T>, raw: unknown): T {
  const r = schema.safeParse(raw)
  if (!r.success) {
    throw new ApiError(500, {
      message: 'response_drift',
      errors: r.error.issues.map(i => ({ code: 'response_drift', message: i.message, path: i.path }))
    })
  }
  return r.data
}

// ---- Methods ----

export async function listWorkflows(): Promise<WorkflowSummary[]> {
  const raw = await apiFetch<unknown>('/workflows')
  return parseOrThrow(z.array(WorkflowSummary), raw)
}

export async function getWorkflow(id: string): Promise<WorkflowDetail> {
  const raw = await apiFetch<unknown>(`/workflows/${id}`)
  return parseOrThrow(WorkflowDetail, raw)
}

export async function createWorkflow(body: CreateWorkflowDto): Promise<WorkflowDetail> {
  const raw = await apiFetch<unknown>('/workflows', { method: 'POST', body })
  return parseOrThrow(WorkflowDetail, raw)
}

export async function updateWorkflow(id: string, body: UpdateWorkflowDto): Promise<WorkflowDetail> {
  const raw = await apiFetch<unknown>(`/workflows/${id}`, { method: 'PATCH', body })
  return parseOrThrow(WorkflowDetail, raw)
}

export async function duplicateWorkflow(id: string, body: DuplicateWorkflowDto): Promise<WorkflowDetail> {
  const raw = await apiFetch<unknown>(`/workflows/${id}/duplicate`, { method: 'POST', body })
  return parseOrThrow(WorkflowDetail, raw)
}

export async function deleteWorkflow(id: string): Promise<void> {
  await apiFetch<void>(`/workflows/${id}`, { method: 'DELETE' })
}
