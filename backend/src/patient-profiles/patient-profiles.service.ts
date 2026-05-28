import { Injectable, NotFoundException } from '@nestjs/common'
import type { CreatePatientProfileDto, UpdatePatientProfileDto } from '@rainpath/shared'
import { PrismaService, buildSoftDeleteClient } from '../prisma/prisma.service'

type PatientProfileOut = {
  id: string
  name: string
  email: string | null
  phone: string | null
  whatsapp: string | null
  address: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

@Injectable()
export class PatientProfilesService {
  private readonly db: ReturnType<typeof buildSoftDeleteClient>

  constructor(private readonly prisma: PrismaService) {
    this.db = buildSoftDeleteClient(prisma)
  }

  async list(): Promise<PatientProfileOut[]> {
    const rows = await this.db.patientProfile.findMany({ orderBy: { updatedAt: 'desc' } })
    return rows.map(r => this.toResponse(r))
  }

  async get(id: string): Promise<PatientProfileOut> {
    const row = await this.db.patientProfile.findUnique({ where: { id } })
    if (!row) throw new NotFoundException(`PatientProfile ${id} not found`)
    return this.toResponse(row)
  }

  async create(dto: CreatePatientProfileDto): Promise<PatientProfileOut> {
    const row = await this.prisma.patientProfile.create({
      data: {
        name: dto.name,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        whatsapp: dto.whatsapp ?? null,
        address: dto.address ?? null
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
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.whatsapp !== undefined ? { whatsapp: dto.whatsapp } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {})
      }
    })
    return this.toResponse(row)
  }

  async softDelete(id: string): Promise<void> {
    const existing = await this.db.patientProfile.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`PatientProfile ${id} not found`)
    await this.prisma.patientProfile.update({ where: { id }, data: { deletedAt: new Date() } })
  }

  private toResponse(row: {
    id: string
    name: string
    email: string | null
    phone: string | null
    whatsapp: string | null
    address: string | null
    createdAt: Date
    updatedAt: Date
    deletedAt: Date | null
  }): PatientProfileOut {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      whatsapp: row.whatsapp,
      address: row.address,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null
    }
  }
}
