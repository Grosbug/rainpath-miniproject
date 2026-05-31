import { Injectable, NotFoundException } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import {
  CreateWorkflowDto,
  DuplicateWorkflowDto,
  Graph,
  START_Y,
  UpdateWorkflowDto,
  WorkflowListQueryDto,
  WorkflowListResponse,
  validateGraph,
} from '@rainpath/shared';
import { PrismaService, buildSoftDeleteClient } from '../prisma/prisma.service';
import {
  GraphErrorItem,
  GraphWarning,
} from '../validation/graph-validation.error';
import { decodeGraph, encodeGraph } from './graph-codec';

type ValidationResult = {
  warnings: GraphWarning[];
  validationErrors: GraphErrorItem[];
};

type WorkflowOut = {
  id: string;
  name: string;
  description: string | null;
  graph: Graph;
  createdAt: string;
  updatedAt: string;
  warnings: GraphWarning[];
  validationErrors: GraphErrorItem[];
};

@Injectable()
export class WorkflowsService {
  private readonly db: ReturnType<typeof buildSoftDeleteClient>;

  constructor(private readonly prisma: PrismaService) {
    this.db = buildSoftDeleteClient(prisma);
  }

  /**
   * Paginated, search-aware listing. `isValid` is read straight from the cached
   * column written on every mutation — no graph decoding, so the query stays
   * O(limit) regardless of dataset size.
   */
  async list(query: WorkflowListQueryDto): Promise<WorkflowListResponse> {
    // `buildSoftDeleteClient` only intercepts find* methods — `count` goes
    // straight through. We assert `deletedAt: null` here so paginated totals
    // match the visible rows.
    const baseWhere: Record<string, unknown> = { deletedAt: null };
    if (query.search) {
      baseWhere.OR = [
        { name: { contains: query.search } },
        { description: { contains: query.search } },
      ];
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.workflow.findMany({
        where: baseWhere,
        orderBy: { updatedAt: 'desc' },
        take: query.limit,
        skip: query.offset,
        select: {
          id: true,
          name: true,
          description: true,
          updatedAt: true,
          isValid: true,
        },
      }),
      this.prisma.workflow.count({ where: baseWhere }),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        updatedAt: r.updatedAt.toISOString(),
        isValid: r.isValid,
      })),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async get(id: string): Promise<WorkflowOut> {
    const row = await this.db.workflow.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Workflow ${id} not found`);
    const graph = decodeGraph(row.graph, row.id);
    return this.toResponse(row, this.validate(graph));
  }

  async create(dto: CreateWorkflowDto): Promise<WorkflowOut> {
    const graph = dto.graph ?? this.defaultGraph();
    const result = this.validate(graph);
    const row = await this.prisma.workflow.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        graph: encodeGraph(graph),
        isValid: result.validationErrors.length === 0,
      },
    });
    return this.toResponse(row, result);
  }

  async update(id: string, dto: UpdateWorkflowDto): Promise<WorkflowOut> {
    const existing = await this.db.workflow.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Workflow ${id} not found`);

    let result: ValidationResult = { warnings: [], validationErrors: [] };
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.graph !== undefined) {
      result = this.validate(dto.graph);
      data.graph = encodeGraph(dto.graph);
      data.isValid = result.validationErrors.length === 0;
    } else {
      result = this.validate(decodeGraph(existing.graph, existing.id));
    }

    const row = await this.prisma.workflow.update({ where: { id }, data });
    return this.toResponse(row, result);
  }

  async duplicate(id: string, dto: DuplicateWorkflowDto): Promise<WorkflowOut> {
    const source = await this.db.workflow.findUnique({ where: { id } });
    if (!source) throw new NotFoundException(`Workflow ${id} not found`);
    const graph = decodeGraph(source.graph, source.id);
    const result = this.validate(graph);
    const row = await this.prisma.workflow.create({
      data: {
        name: dto.name ?? `${source.name} (copie)`,
        description: source.description,
        graph: encodeGraph(graph),
        isValid: result.validationErrors.length === 0,
      },
    });
    return this.toResponse(row, result);
  }

  async softDelete(id: string): Promise<void> {
    const existing = await this.db.workflow.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Workflow ${id} not found`);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.workflow.update({ where: { id }, data: { deletedAt: now } }),
      this.prisma.patientRun.updateMany({
        where: { workflowId: id, deletedAt: null },
        data: { deletedAt: now },
      }),
    ]);
  }

  private validate(graph: Graph): ValidationResult {
    const { errors, warnings } = validateGraph(graph);
    return { warnings, validationErrors: errors };
  }

  private defaultGraph(): Graph {
    const startId = createId();
    const endId = createId();
    return {
      nodes: [
        {
          id: startId,
          position: { x: 0, y: START_Y },
          data: { kind: 'start' },
        },
        { id: endId, position: { x: 30, y: START_Y }, data: { kind: 'end' } },
      ],
      edges: [],
    };
  }

  private toResponse(
    row: {
      id: string;
      name: string;
      description: string | null;
      graph: string;
      createdAt: Date;
      updatedAt: Date;
    },
    result: ValidationResult,
  ): WorkflowOut {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      graph: decodeGraph(row.graph, row.id),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      warnings: result.warnings,
      validationErrors: result.validationErrors,
    };
  }
}
