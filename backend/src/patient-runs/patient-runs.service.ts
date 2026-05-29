import { BadRequestException, HttpException, Injectable, NotFoundException } from '@nestjs/common'
import type {
  AdvancePatientRunDto, CreatePatientRunDto, Graph, PatientGender, PostalAddress
} from '@rainpath/shared'
import { validateGraph } from '@rainpath/shared'
import { PrismaService, buildSoftDeleteClient } from '../prisma/prisma.service'
import { decodeGraph } from '../workflows/graph-codec'
import { AdvanceError, resolveAdvance } from './advance'

type RunHistoryEntry = { nodeId: string; enteredAt: string; outcome?: string }

type PatientRunSummary = {
  id: string
  patient: { id: string; name: string; deletedAt: string | null }
  currentNodeId: string | null
  startDate: string
  updatedAt: string
}

type PatientRunForPatient = {
  id: string
  workflow: { id: string; name: string }
  currentNodeId: string | null
  startDate: string
  updatedAt: string
}

type PatientRunFull = {
  id: string
  workflowId: string
  workflow: { id: string; name: string; graph: Graph }
  patient: {
    id: string
    firstName: string
    lastName: string
    name: string
    gender: PatientGender
    email: string | null
    phone: string | null
    whatsapp: string | null
    /** Structured postal address (or null if no address on file). */
    address: PostalAddress | null
    deletedAt: string | null
  }
  currentNodeId: string | null
  history: RunHistoryEntry[]
  startDate: string
  createdAt: string
  updatedAt: string
}

function fullName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`.trim()
}

/** Mirror of PatientProfilesService.parseAddress — kept local to avoid a cross-module import
 *  for what is effectively a thin JSON marshaller. */
function parsePatientAddress(raw: string | null): PostalAddress | null {
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
          name: p ? fullName(p) : 'Patient inconnu',
          deletedAt: p?.deletedAt ? p.deletedAt.toISOString() : null
        },
        currentNodeId: r.currentNodeId,
        startDate: r.startDate.toISOString(),
        updatedAt: r.updatedAt.toISOString()
      }
    })
  }

  async listForPatient(patientId: string): Promise<PatientRunForPatient[]> {
    const patient = await this.db.patientProfile.findUnique({ where: { id: patientId } })
    if (!patient) throw new NotFoundException(`PatientProfile ${patientId} not found`)

    const rows = await this.db.patientRun.findMany({
      where: { patientId },
      orderBy: { updatedAt: 'desc' }
    })

    if (rows.length === 0) return []

    const workflowIds = Array.from(new Set(rows.map(r => r.workflowId)))
    const workflows = await this.prisma.workflow.findMany({
      where: { id: { in: workflowIds } }
    })
    const byId = new Map(workflows.map(w => [w.id, w]))

    return rows.map(r => {
      const wf = byId.get(r.workflowId)
      return {
        id: r.id,
        workflow: {
          id: r.workflowId,
          name: wf?.name ?? 'Workflow inconnu'
        },
        currentNodeId: r.currentNodeId,
        startDate: r.startDate.toISOString(),
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
    const gender: PatientGender = patient.gender === 'female' ? 'female' : 'male'

    return {
      id: row.id,
      workflowId: row.workflowId,
      workflow: { id: wf.id, name: wf.name, graph },
      patient: {
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        name: fullName(patient),
        gender,
        email: patient.email,
        phone: patient.phone,
        whatsapp: patient.whatsapp,
        address: parsePatientAddress(patient.address),
        deletedAt: patient.deletedAt ? patient.deletedAt.toISOString() : null
      },
      currentNodeId: row.currentNodeId,
      history,
      startDate: row.startDate.toISOString(),
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

    const validation = validateGraph(graph)
    if (validation.errors.length > 0) {
      throw new BadRequestException('Impossible de créer un parcours sur un workflow invalide')
    }

    const startNode = graph.nodes.find(n => n.data.kind === 'start')
    if (!startNode) throw new BadRequestException(`Workflow ${workflowId} has no start node`)

    const history: RunHistoryEntry[] = [{ nodeId: startNode.id, enteredAt: new Date().toISOString() }]
    const startDate = dto.startDate ? new Date(dto.startDate) : new Date()

    const row = await this.prisma.patientRun.create({
      data: {
        workflowId,
        patientId: dto.patientId,
        currentNodeId: startNode.id,
        history: JSON.stringify(history),
        startDate
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
    const entry: RunHistoryEntry = { nodeId: result.nextNodeId, enteredAt: new Date().toISOString() }
    if (result.outcome !== undefined) entry.outcome = result.outcome
    history.push(entry)

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

  /**
   * Pop the last history entry and point `currentNodeId` back at the previous one.
   * No-op when the run is already at start (history length ≤ 1). Symmetric with
   * `advance` for one step — useful when the user wants to undo a wrongly-picked
   * outcome without losing the rest of the run's progress.
   */
  async stepBack(id: string): Promise<PatientRunFull> {
    const row = await this.db.patientRun.findUnique({ where: { id } })
    if (!row) throw new NotFoundException(`PatientRun ${id} not found`)

    const history: RunHistoryEntry[] = JSON.parse(row.history)
    if (history.length <= 1) return this.get(id)

    const trimmed = history.slice(0, -1)
    const newCurrent = trimmed[trimmed.length - 1]!

    await this.prisma.patientRun.update({
      where: { id },
      data: {
        currentNodeId: newCurrent.nodeId,
        history: JSON.stringify(trimmed)
      }
    })

    return this.get(id)
  }
}
