import { BadRequestException, HttpException, Injectable, NotFoundException } from '@nestjs/common'
import type { AdvancePatientRunDto, CreatePatientRunDto, Graph } from '@rainpath/shared'
import { PrismaService, buildSoftDeleteClient } from '../prisma/prisma.service'
import { decodeGraph } from '../workflows/graph-codec'
import { AdvanceError, resolveAdvance } from './advance'

type RunHistoryEntry = { nodeId: string; enteredAt: string; outcome?: string }

type PatientRunSummary = {
  id: string
  patient: { id: string; name: string; deletedAt: string | null }
  currentNodeId: string | null
  updatedAt: string
}

type PatientRunFull = {
  id: string
  workflowId: string
  workflow: { id: string; name: string; graph: Graph }
  patient: {
    id: string
    name: string
    email: string | null
    phone: string | null
    whatsapp: string | null
    address: string | null
    deletedAt: string | null
  }
  currentNodeId: string | null
  history: RunHistoryEntry[]
  createdAt: string
  updatedAt: string
}

@Injectable()
export class PatientRunsService {
  private readonly db: ReturnType<typeof buildSoftDeleteClient>

  constructor(private readonly prisma: PrismaService) {
    this.db = buildSoftDeleteClient(prisma)
  }

  async listForWorkflow(workflowId: string): Promise<PatientRunSummary[]> {
    const wf = await this.db.workflow.findUnique({ where: { id: workflowId } })
    if (!wf) throw new NotFoundException(`Workflow ${workflowId} not found`)

    const rows = await this.db.patientRun.findMany({
      where: { workflowId },
      orderBy: { updatedAt: 'desc' }
    })

    if (rows.length === 0) return []

    const patientIds = Array.from(new Set(rows.map(r => r.patientId)))
    const patients = await this.prisma.patientProfile.findMany({
      where: { id: { in: patientIds } }
    })
    const byId = new Map(patients.map(p => [p.id, p]))

    return rows.map(r => {
      const p = byId.get(r.patientId)
      return {
        id: r.id,
        patient: {
          id: r.patientId,
          name: p?.name ?? 'Patient inconnu',
          deletedAt: p?.deletedAt ? p.deletedAt.toISOString() : null
        },
        currentNodeId: r.currentNodeId,
        updatedAt: r.updatedAt.toISOString()
      }
    })
  }

  async get(id: string): Promise<PatientRunFull> {
    const row = await this.db.patientRun.findUnique({ where: { id } })
    if (!row) throw new NotFoundException(`PatientRun ${id} not found`)
    const wf = await this.prisma.workflow.findUnique({ where: { id: row.workflowId } })
    if (!wf) throw new NotFoundException(`Workflow ${row.workflowId} not found`)
    const patient = await this.prisma.patientProfile.findUnique({ where: { id: row.patientId } })
    if (!patient) throw new NotFoundException(`PatientProfile ${row.patientId} not found`)

    const graph = decodeGraph(wf.graph, wf.id)
    const history = JSON.parse(row.history) as RunHistoryEntry[]

    return {
      id: row.id,
      workflowId: row.workflowId,
      workflow: { id: wf.id, name: wf.name, graph },
      patient: {
        id: patient.id,
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        whatsapp: patient.whatsapp,
        address: patient.address,
        deletedAt: patient.deletedAt ? patient.deletedAt.toISOString() : null
      },
      currentNodeId: row.currentNodeId,
      history,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    }
  }

  async create(workflowId: string, dto: CreatePatientRunDto): Promise<PatientRunFull> {
    const wf = await this.db.workflow.findUnique({ where: { id: workflowId } })
    if (!wf) throw new NotFoundException(`Workflow ${workflowId} not found`)
    const patient = await this.db.patientProfile.findUnique({ where: { id: dto.patientId } })
    if (!patient) throw new NotFoundException(`PatientProfile ${dto.patientId} not found`)

    const graph = decodeGraph(wf.graph, wf.id)
    const startNode = graph.nodes.find(n => n.data.kind === 'start')
    if (!startNode) throw new BadRequestException(`Workflow ${workflowId} has no start node`)

    const history: RunHistoryEntry[] = [{ nodeId: startNode.id, enteredAt: new Date().toISOString() }]

    const row = await this.prisma.patientRun.create({
      data: {
        workflowId,
        patientId: dto.patientId,
        currentNodeId: startNode.id,
        history: JSON.stringify(history)
      }
    })

    return this.get(row.id)
  }

  async advance(id: string, dto: AdvancePatientRunDto): Promise<PatientRunFull> {
    const row = await this.db.patientRun.findUnique({ where: { id } })
    if (!row) throw new NotFoundException(`PatientRun ${id} not found`)
    if (!row.currentNodeId) throw new BadRequestException(`PatientRun ${id} has no current node`)

    const wf = await this.prisma.workflow.findUnique({ where: { id: row.workflowId } })
    if (!wf) throw new NotFoundException(`Workflow ${row.workflowId} not found`)
    const graph = decodeGraph(wf.graph, wf.id)

    let result: { nextNodeId: string; outcome?: string }
    try {
      result = resolveAdvance({ graph, currentNodeId: row.currentNodeId, outcome: dto.outcome })
    } catch (e) {
      if (e instanceof AdvanceError) {
        throw new HttpException(
          { statusCode: e.status, errors: [{ code: e.code, message: e.message, ...e.detail }], warnings: [] },
          e.status
        )
      }
      throw e
    }

    const history = JSON.parse(row.history) as RunHistoryEntry[]
    history.push({
      nodeId: result.nextNodeId,
      enteredAt: new Date().toISOString(),
      outcome: result.outcome
    })

    await this.prisma.patientRun.update({
      where: { id },
      data: {
        currentNodeId: result.nextNodeId,
        history: JSON.stringify(history)
      }
    })

    return this.get(id)
  }

  async reset(id: string): Promise<PatientRunFull> {
    const row = await this.db.patientRun.findUnique({ where: { id } })
    if (!row) throw new NotFoundException(`PatientRun ${id} not found`)
    const wf = await this.prisma.workflow.findUnique({ where: { id: row.workflowId } })
    if (!wf) throw new NotFoundException(`Workflow ${row.workflowId} not found`)

    const graph = decodeGraph(wf.graph, wf.id)
    const startNode = graph.nodes.find(n => n.data.kind === 'start')
    if (!startNode) throw new BadRequestException(`Workflow ${row.workflowId} has no start node`)

    const history: RunHistoryEntry[] = [{ nodeId: startNode.id, enteredAt: new Date().toISOString() }]

    await this.prisma.patientRun.update({
      where: { id },
      data: {
        currentNodeId: startNode.id,
        history: JSON.stringify(history)
      }
    })

    return this.get(id)
  }
}
