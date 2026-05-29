import { z } from 'zod'
import type { CreateNodeTemplateDto, NodeTemplate, UpdateNodeTemplateDto } from '@rainpath/shared'
import { ApiError, apiFetch } from './client'

const NodeTemplateResp = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  kind: z.enum(['send_email', 'send_sms', 'send_whatsapp', 'send_postal']),
  params: z.unknown(),
  createdAt: z.string(),
  updatedAt: z.string()
})

function parseOne(raw: unknown): NodeTemplate {
  const r = NodeTemplateResp.safeParse(raw)
  if (!r.success) {
    throw new ApiError(500, {
      message: 'response_drift',
      errors: r.error.issues.map(i => ({ code: 'response_drift', message: i.message, path: i.path }))
    })
  }
  return { ...r.data, description: r.data.description ?? undefined } as unknown as NodeTemplate
}

function parseList(raw: unknown): NodeTemplate[] {
  if (!Array.isArray(raw)) {
    throw new ApiError(500, { message: 'response_drift', errors: [{ code: 'not_array', message: 'expected array' }] })
  }
  return raw.map(parseOne)
}

export async function listNodeTemplates(): Promise<NodeTemplate[]> {
  const raw = await apiFetch<unknown>('/node-templates')
  return parseList(raw)
}

export async function createNodeTemplate(body: CreateNodeTemplateDto): Promise<NodeTemplate> {
  const raw = await apiFetch<unknown>('/node-templates', { method: 'POST', body })
  return parseOne(raw)
}

export async function updateNodeTemplate(id: string, body: UpdateNodeTemplateDto): Promise<NodeTemplate> {
  const raw = await apiFetch<unknown>(`/node-templates/${id}`, { method: 'PATCH', body })
  return parseOne(raw)
}

export async function deleteNodeTemplate(id: string): Promise<void> {
  await apiFetch<void>(`/node-templates/${id}`, { method: 'DELETE' })
}
