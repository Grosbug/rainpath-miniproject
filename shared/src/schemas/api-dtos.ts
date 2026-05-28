import { z } from 'zod'
import { Graph } from './primitives'
import { NodeTemplateBody } from './node-template'

// Workflows
export const CreateWorkflowDto = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  graph: Graph.optional()
})
export type CreateWorkflowDto = z.infer<typeof CreateWorkflowDto>

export const UpdateWorkflowDto = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  graph: Graph.optional()
})
export type UpdateWorkflowDto = z.infer<typeof UpdateWorkflowDto>

export const DuplicateWorkflowDto = z.object({
  name: z.string().min(1).optional()
})
export type DuplicateWorkflowDto = z.infer<typeof DuplicateWorkflowDto>

// Node templates
export const CreateNodeTemplateDto = z.intersection(
  NodeTemplateBody,
  z.object({
    name: z.string().min(1),
    description: z.string().optional()
  })
)
export type CreateNodeTemplateDto = z.infer<typeof CreateNodeTemplateDto>

export const UpdateNodeTemplateDto = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  params: z.unknown().optional() // validated against kind in the service
})
export type UpdateNodeTemplateDto = z.infer<typeof UpdateNodeTemplateDto>

// Patient profile
export const CreatePatientProfileDto = z.object({
  name: z.string().min(1),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  address: z.string().nullable().optional()
})
export type CreatePatientProfileDto = z.infer<typeof CreatePatientProfileDto>

export const UpdatePatientProfileDto = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  address: z.string().nullable().optional()
})
export type UpdatePatientProfileDto = z.infer<typeof UpdatePatientProfileDto>

// Patient run
export const CreatePatientRunDto = z.object({
  patientId: z.string().min(1)
})
export type CreatePatientRunDto = z.infer<typeof CreatePatientRunDto>

export const AdvancePatientRunDto = z.object({
  outcome: z.string().optional()
})
export type AdvancePatientRunDto = z.infer<typeof AdvancePatientRunDto>
