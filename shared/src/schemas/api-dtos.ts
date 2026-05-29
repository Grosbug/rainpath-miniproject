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
export const PatientGender = z.enum(['male', 'female'])
export type PatientGender = z.infer<typeof PatientGender>

/**
 * French CP — 5 digits, leading 0 allowed. Stricter than a free-form string so the
 * postal node can rely on a well-formed code at runtime (e.g. to route by département).
 */
export const PostalCode = z.string().regex(/^\d{5}$/, {
  message: 'Code postal invalide (5 chiffres attendus)'
})
export type PostalCode = z.infer<typeof PostalCode>

/**
 * Structured postal address — replaces the previous free-form `address: string` + flat
 * `postalCode: string` pair. Stored as a single JSON-encoded column in the DB, marshalled
 * back to this object at the service boundary. `country` defaults to "France" in the
 * profile form but is kept optional in the type so legacy profiles can read back null.
 */
export const PostalAddress = z.object({
  street: z.string().min(1),
  postalCode: PostalCode,
  city: z.string().min(1),
  country: z.string().nullable().optional()
})
export type PostalAddress = z.infer<typeof PostalAddress>

const OptionalAddress = PostalAddress.nullable().optional()

export const CreatePatientProfileDto = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  gender: PatientGender,
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  address: OptionalAddress
})
export type CreatePatientProfileDto = z.infer<typeof CreatePatientProfileDto>

export const UpdatePatientProfileDto = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  gender: PatientGender.optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  address: OptionalAddress
})
export type UpdatePatientProfileDto = z.infer<typeof UpdatePatientProfileDto>

// Patient run
export const CreatePatientRunDto = z.object({
  patientId: z.string().min(1),
  startDate: z.string().datetime().optional()
})
export type CreatePatientRunDto = z.infer<typeof CreatePatientRunDto>

export const AdvancePatientRunDto = z.object({
  outcome: z.string().optional(),
  /** Node to enter (frontier) or leave (visited). Defaults to focusedNodeId. */
  nodeId: z.string().min(1).optional()
})
export type AdvancePatientRunDto = z.infer<typeof AdvancePatientRunDto>

export const FocusPatientRunDto = z.object({
  nodeId: z.string().min(1)
})
export type FocusPatientRunDto = z.infer<typeof FocusPatientRunDto>
