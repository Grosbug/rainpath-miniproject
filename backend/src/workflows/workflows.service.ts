import { Injectable, NotFoundException } from '@nestjs/common'
import { createId } from '@paralleldrive/cuid2'
import {
  CreateWorkflowDto,
  DuplicateWorkflowDto,
  Graph,
  START_Y,
  UpdateWorkflowDto,
  validateGraph
} from '@rainpath/shared'
import { PrismaService, buildSoftDeleteClient } from '../prisma/prisma.service'
import { GraphValidationError, GraphWarning } from '../validation/graph-validation.error'
import { decodeGraph, encodeGraph } from './graph-codec'

type WorkflowOut = {
  id: string
  name: string
  description: string | null
  graph: Graph
  createdAt: string
  updatedAt: string
  warnings: GraphWarning[]
}

@Injectable()
export class WorkflowsService {
  private readonly db: ReturnType<typeof buildSoftDeleteClient>

  constructor(private readonly prisma: PrismaService) {
    this.db = buildSoftDeleteClient(prisma)
  }

  async list() {
    const rows = await this.db.workflow.findMany({
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, description: true, updatedAt: true }
    })
    return rows.map(r => ({ ...r, updatedAt: r.updatedAt.toISOString() }))
  }

  async get(id: string): Promise<WorkflowOut> {
    const row = await this.db.workflow.findUnique({ where: { id } })
    if (!row) throw new NotFoundException(`Workflow ${id} not found`)
    return this.toResponse(row, [])
  }

  async create(dto: CreateWorkflowDto): Promise<WorkflowOut> {
    const graph = dto.graph ?? this.defaultGraph()
    const warnings = this.validate(graph)
    const row = await this.prisma.workflow.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        graph: encodeGraph(graph)
      }
    })
    return this.toResponse(row, warnings)
  }

  async update(id: string, dto: UpdateWorkflowDto): Promise<WorkflowOut> {
    const existing = await this.db.workflow.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Workflow ${id} not found`)

    let warnings: GraphWarning[] = []
    const data: Record<string, unknown> = {}
    if (dto.name !== undefined) data.name = dto.name
    if (dto.description !== undefined) data.description = dto.description
    if (dto.graph !== undefined) {
      warnings = this.validate(dto.graph)
      data.graph = encodeGraph(dto.graph)
    }

    const row = await this.prisma.workflow.update({ where: { id }, data })
    return this.toResponse(row, warnings)
  }

  async duplicate(id: string, dto: DuplicateWorkflowDto): Promise<WorkflowOut> {
    const source = await this.db.workflow.findUnique({ where: { id } })
    if (!source) throw new NotFoundException(`Workflow ${id} not found`)
    const graph = decodeGraph(source.graph, source.id)
    const warnings = this.validate(graph)
    const row = await this.prisma.workflow.create({
      data: {
        name: dto.name ?? `${source.name} (copie)`,
        description: source.description,
        graph: encodeGraph(graph)
      }
    })
    return this.toResponse(row, warnings)
  }

  async softDelete(id: string): Promise<void> {
    const existing = await this.db.workflow.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Workflow ${id} not found`)
    const now = new Date()
    await this.prisma.$transaction([
      this.prisma.workflow.update({ where: { id }, data: { deletedAt: now } }),
      this.prisma.patientRun.updateMany({
        where: { workflowId: id, deletedAt: null },
        data: { deletedAt: now }
      })
    ])
  }

  private validate(graph: Graph): GraphWarning[] {
    const { errors, warnings } = validateGraph(graph)
    if (errors.length > 0) throw new GraphValidationError(errors, warnings)
    return warnings
  }

  private defaultGraph(): Graph {
    const startId = createId()
    const endId = createId()
    const edgeId = createId()
    return {
      nodes: [
        { id: startId, position: { x: 0, y: START_Y }, data: { kind: 'start' } },
        { id: endId, position: { x: 30, y: START_Y }, data: { kind: 'end' } }
      ],
      edges: [{ id: edgeId, source: startId, target: endId, daysAfter: 30 }]
    }
  }

  private toResponse(
    row: { id: string; name: string; description: string | null; graph: string; createdAt: Date; updatedAt: Date },
    warnings: GraphWarning[]
  ): WorkflowOut {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      graph: decodeGraph(row.graph, row.id),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      warnings
    }
  }
}
