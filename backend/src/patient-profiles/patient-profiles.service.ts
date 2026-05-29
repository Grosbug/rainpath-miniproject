import { Injectable, NotFoundException } from '@nestjs/common'
import type {
  CreatePatientProfileDto,
  PatientGender,
  PostalAddress,
  UpdatePatientProfileDto
} from '@rainpath/shared'
import { PrismaService, buildSoftDeleteClient } from '../prisma/prisma.service'

type PatientProfileOut = {
  id: string
  firstName: string
  lastName: string
  name: string
  gender: PatientGender
  email: string | null
  phone: string | null
  whatsapp: string | null
  /** Structured postal address — null when the patient has no address on file. */
  address: PostalAddress | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  /** Non-soft-deleted runs attached to this patient — surfaced in the list page so
   *  the operator can spot at a glance who has an active simulation. Counts all
   *  runs ; we don't try to distinguish "finished at end-node" here (that would
   *  require decoding every workflow graph). Use the detail dialog or the runs
   *  endpoint for that nuance. Only populated by `list()` (single-patient reads
   *  leave it undefined to keep the per-route shapes minimal). */
  runsCount?: number
}

type PatientProfileRow = {
  id: string
  firstName: string
  lastName: string
  gender: string
  email: string | null
  phone: string | null
  whatsapp: string | null
  /** JSON-encoded PostalAddress, kept in the existing TEXT column to avoid a migration
   *  for the SQLite dev DB. The legacy postalCode column lingers but is no longer
   *  written or read by the service. */
  address: string | null
  postalCode: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

function serializeAddress(addr: PostalAddress | null | undefined): string | null {
  if (!addr) return null
  return JSON.stringify(addr)
}

function parseAddress(raw: string | null): PostalAddress | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && 'street' in parsed && 'postalCode' in parsed && 'city' in parsed) {
      return parsed as PostalAddress
    }
    return null
  } catch {
    return null
  }
}

@Injectable()
export class PatientProfilesService {
  private readonly db: ReturnType<typeof buildSoftDeleteClient>

  constructor(private readonly prisma: PrismaService) {
    this.db = buildSoftDeleteClient(prisma)
  }

  async list(): Promise<PatientProfileOut[]> {
    const rows = await this.db.patientProfile.findMany({ orderBy: { updatedAt: 'desc' } })
    if (rows.length === 0) return []

    // Single GROUP BY query for run counts — avoids N+1 when the list grows.
    // The soft-delete client wrapper only intercepts find*, not groupBy, so
    // `deletedAt: null` is asserted explicitly here.
    const counts = await this.prisma.patientRun.groupBy({
      by: ['patientId'],
      where: { patientId: { in: rows.map(r => r.id) }, deletedAt: null },
      _count: { _all: true }
    })
    const byPatient = new Map<string, number>(
      counts.map(c => [c.patientId, c._count._all])
    )

    return rows.map(r => ({
      ...this.toResponse(r),
      runsCount: byPatient.get(r.id) ?? 0
    }))
  }

  async get(id: string): Promise<PatientProfileOut> {
    const row = await this.db.patientProfile.findUnique({ where: { id } })
    if (!row) throw new NotFoundException(`PatientProfile ${id} not found`)
    return this.toResponse(row)
  }

  async create(dto: CreatePatientProfileDto): Promise<PatientProfileOut> {
    const row = await this.prisma.patientProfile.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        gender: dto.gender,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        whatsapp: dto.whatsapp ?? null,
        address: serializeAddress(dto.address)
      }
    })
    return this.toResponse(row)
  }

  async update(id: string, dto: UpdatePatientProfileDto): Promise<PatientProfileOut> {
    const existing = await this.db.patientProfile.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`PatientProfile ${id} not found`)
    const row = await this.prisma.patientProfile.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
        ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.whatsapp !== undefined ? { whatsapp: dto.whatsapp } : {}),
        ...(dto.address !== undefined ? { address: serializeAddress(dto.address) } : {})
      }
    })
    return this.toResponse(row)
  }

  async softDelete(id: string): Promise<void> {
    const existing = await this.db.patientProfile.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`PatientProfile ${id} not found`)
    await this.prisma.patientProfile.update({ where: { id }, data: { deletedAt: new Date() } })
  }

  private toResponse(row: PatientProfileRow): PatientProfileOut {
    const gender: PatientGender = row.gender === 'female' ? 'female' : 'male'
    return {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      name: `${row.firstName} ${row.lastName}`.trim(),
      gender,
      email: row.email,
      phone: row.phone,
      whatsapp: row.whatsapp,
      address: parseAddress(row.address),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null
    }
  }
}
