import { z } from 'zod'
import type { CreatePatientProfileDto, UpdatePatientProfileDto } from '@rainpath/shared'
import { ApiError, apiFetch } from './client'

const PatientProfile = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  address: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable()
})
export type PatientProfile = z.infer<typeof PatientProfile>

function parseOne(raw: unknown): PatientProfile {
  const r = PatientProfile.safeParse(raw)
  if (!r.success) {
    throw new ApiError(500, {
      message: 'response_drift',
      errors: r.error.issues.map(i => ({ code: 'response_drift', message: i.message, path: i.path }))
    })
  }
  return r.data
}

function parseList(raw: unknown): PatientProfile[] {
  const r = z.array(PatientProfile).safeParse(raw)
  if (!r.success) {
    throw new ApiError(500, {
      message: 'response_drift',
      errors: r.error.issues.map(i => ({ code: 'response_drift', message: i.message, path: i.path }))
    })
  }
  return r.data
}

export async function listPatientProfiles(): Promise<PatientProfile[]> {
  const raw = await apiFetch<unknown>('/patient-profiles')
  return parseList(raw)
}

export async function getPatientProfile(id: string): Promise<PatientProfile> {
  const raw = await apiFetch<unknown>(`/patient-profiles/${id}`)
  return parseOne(raw)
}

export async function createPatientProfile(body: CreatePatientProfileDto): Promise<PatientProfile> {
  const raw = await apiFetch<unknown>('/patient-profiles', { method: 'POST', body })
  return parseOne(raw)
}

export async function updatePatientProfile(id: string, body: UpdatePatientProfileDto): Promise<PatientProfile> {
  const raw = await apiFetch<unknown>(`/patient-profiles/${id}`, { method: 'PATCH', body })
  return parseOne(raw)
}

export async function deletePatientProfile(id: string): Promise<void> {
  await apiFetch<void>(`/patient-profiles/${id}`, { method: 'DELETE' })
}
