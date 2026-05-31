import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AdvancePatientRunDto,
  CreatePatientRunDto,
  FocusPatientRunDto,
  UpdatePatientRunDto,
} from '@rainpath/shared';
import {
  AdvanceRunError,
  applyRunAdvance,
  validateGraph,
} from '@rainpath/shared';
import { PrismaService, buildSoftDeleteClient } from '../prisma/prisma.service';
import { decodeGraph } from '../workflows/graph-codec';
import { AdvanceError, resolveAdvance } from './advance';
import { buildRunSimulationState } from './run-state';
import {
  initialHistoryAtStart,
  parseRunHistory,
  serializeRunHistory,
  type RunHistoryEntry,
} from './run-history-codec';
import {
  fullName,
  toPatientRunFull,
  type PatientRunFull,
} from './run-presenter';

type PatientRunSummary = {
  id: string;
  title: string;
  patient: { id: string; name: string; deletedAt: string | null };
  currentNodeId: string | null;
  startDate: string;
  updatedAt: string;
};

type PatientRunForPatient = {
  id: string;
  title: string;
  workflow: { id: string; name: string };
  currentNodeId: string | null;
  startDate: string;
  updatedAt: string;
};

@Injectable()
export class PatientRunsService {
  private readonly db: ReturnType<typeof buildSoftDeleteClient>;

  constructor(private readonly prisma: PrismaService) {
    this.db = buildSoftDeleteClient(prisma);
  }

  async listForWorkflow(workflowId: string): Promise<PatientRunSummary[]> {
    const wf = await this.db.workflow.findUnique({ where: { id: workflowId } });
    if (!wf) throw new NotFoundException(`Workflow ${workflowId} not found`);

    const rows = await this.db.patientRun.findMany({
      where: { workflowId },
      orderBy: { updatedAt: 'desc' },
    });
    if (rows.length === 0) return [];

    const patientIds = Array.from(new Set(rows.map((r) => r.patientId)));
    const patients = await this.prisma.patientProfile.findMany({
      where: { id: { in: patientIds } },
    });
    const byId = new Map(patients.map((p) => [p.id, p]));

    return rows.map((r) => {
      const p = byId.get(r.patientId);
      return {
        id: r.id,
        title: r.title,
        patient: {
          id: r.patientId,
          name: p ? fullName(p) : 'Patient inconnu',
          deletedAt: p?.deletedAt ? p.deletedAt.toISOString() : null,
        },
        currentNodeId: r.currentNodeId,
        startDate: r.startDate.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      };
    });
  }

  async listForPatient(patientId: string): Promise<PatientRunForPatient[]> {
    const patient = await this.db.patientProfile.findUnique({
      where: { id: patientId },
    });
    if (!patient)
      throw new NotFoundException(`PatientProfile ${patientId} not found`);

    const rows = await this.db.patientRun.findMany({
      where: { patientId },
      orderBy: { updatedAt: 'desc' },
    });
    if (rows.length === 0) return [];

    const workflowIds = Array.from(new Set(rows.map((r) => r.workflowId)));
    const workflows = await this.prisma.workflow.findMany({
      where: { id: { in: workflowIds } },
    });
    const byId = new Map(workflows.map((w) => [w.id, w]));

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      workflow: {
        id: r.workflowId,
        name: byId.get(r.workflowId)?.name ?? 'Workflow inconnu',
      },
      currentNodeId: r.currentNodeId,
      startDate: r.startDate.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async get(id: string): Promise<PatientRunFull> {
    const { run, workflow, patient, graph } = await this.loadRunBundle(id);
    return toPatientRunFull(run, workflow, patient, graph);
  }

  async create(
    workflowId: string,
    dto: CreatePatientRunDto,
  ): Promise<PatientRunFull> {
    const wf = await this.db.workflow.findUnique({ where: { id: workflowId } });
    if (!wf) throw new NotFoundException(`Workflow ${workflowId} not found`);
    const patient = await this.db.patientProfile.findUnique({
      where: { id: dto.patientId },
    });
    if (!patient)
      throw new NotFoundException(`PatientProfile ${dto.patientId} not found`);

    const graph = decodeGraph(wf.graph, wf.id);
    if (validateGraph(graph).errors.length > 0) {
      throw new BadRequestException(
        'Impossible de créer un parcours sur un workflow invalide',
      );
    }

    const startNode = graph.nodes.find((n) => n.data.kind === 'start');
    if (!startNode)
      throw new BadRequestException(`Workflow ${workflowId} has no start node`);

    const history = initialHistoryAtStart(startNode.id);
    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();

    const row = await this.prisma.patientRun.create({
      data: {
        workflowId,
        patientId: dto.patientId,
        title: dto.title,
        currentNodeId: startNode.id,
        focusedNodeId: startNode.id,
        history: serializeRunHistory(history),
        startDate,
      },
    });
    return this.get(row.id);
  }

  async update(
    id: string,
    dto: UpdatePatientRunDto,
  ): Promise<PatientRunForPatient> {
    const row = await this.db.patientRun.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`PatientRun ${id} not found`);

    if (dto.title === undefined && dto.startDate === undefined) {
      throw new BadRequestException('Aucun champ à mettre à jour');
    }

    const data: { title?: string; startDate?: Date } = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);

    const updated = await this.prisma.patientRun.update({
      where: { id },
      data,
    });
    const wf = await this.prisma.workflow.findUnique({
      where: { id: updated.workflowId },
    });
    return {
      id: updated.id,
      title: updated.title,
      workflow: {
        id: updated.workflowId,
        name: wf?.name ?? 'Workflow inconnu',
      },
      currentNodeId: updated.currentNodeId,
      startDate: updated.startDate.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async advance(
    id: string,
    dto: AdvancePatientRunDto,
  ): Promise<PatientRunFull> {
    const { run, graph } = await this.loadRunBundle(id);
    const history = parseRunHistory(run.history);
    const sim = buildRunSimulationState(
      graph,
      history,
      run.focusedNodeId ?? run.currentNodeId,
    );
    const nodeId = dto.nodeId ?? sim.focusedNodeId;
    if (!nodeId)
      throw new BadRequestException(`PatientRun ${id} has no focused node`);

    const { history: nextHistory, focusNodeId } = this.runAdvanceTransition(
      graph,
      history,
      nodeId,
      dto.outcome,
    );

    await this.prisma.patientRun.update({
      where: { id },
      data: {
        currentNodeId: focusNodeId,
        focusedNodeId: focusNodeId,
        history: serializeRunHistory(nextHistory),
      },
    });
    return this.get(id);
  }

  async focus(id: string, dto: FocusPatientRunDto): Promise<PatientRunFull> {
    const { run, graph } = await this.loadRunBundle(id);
    const history = parseRunHistory(run.history);
    const sim = buildRunSimulationState(graph, history, dto.nodeId);

    if (!sim.actionableNodeIds.includes(dto.nodeId)) {
      throw new BadRequestException(`Node ${dto.nodeId} is not actionable`);
    }

    await this.prisma.patientRun.update({
      where: { id },
      data: { focusedNodeId: dto.nodeId, currentNodeId: dto.nodeId },
    });
    return this.get(id);
  }

  async reset(id: string): Promise<PatientRunFull> {
    const { run, graph } = await this.loadRunBundle(id);
    const startNode = graph.nodes.find((n) => n.data.kind === 'start');
    if (!startNode)
      throw new BadRequestException(
        `Workflow ${run.workflowId} has no start node`,
      );

    const history = initialHistoryAtStart(startNode.id);
    await this.prisma.patientRun.update({
      where: { id },
      data: {
        currentNodeId: startNode.id,
        focusedNodeId: startNode.id,
        history: serializeRunHistory(history),
      },
    });
    return this.get(id);
  }

  /**
   * Soft delete: the run row stays in the DB but disappears from every list
   * (the soft-delete client filters `deletedAt: null` on find*) and from the
   * profile's `runsCount` aggregate. Detail / advance / reset endpoints become
   * 404. Use this to let operators clean up obsolete or test runs from the
   * patient profile detail dialog without losing audit history.
   */
  async softDelete(id: string): Promise<void> {
    const existing = await this.db.patientRun.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`PatientRun ${id} not found`);
    await this.prisma.patientRun.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Load a run + its workflow + its patient profile in one place, with the
   * graph decoded once. Every "needs full context" endpoint (`get`, `advance`,
   * `focus`, `reset`) goes through this so a missing related row 404s with a
   * consistent message instead of crashing inside `parseRunHistory` later.
   */
  private async loadRunBundle(id: string) {
    const run = await this.db.patientRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException(`PatientRun ${id} not found`);
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: run.workflowId },
    });
    if (!workflow)
      throw new NotFoundException(`Workflow ${run.workflowId} not found`);
    const patient = await this.prisma.patientProfile.findUnique({
      where: { id: run.patientId },
    });
    if (!patient)
      throw new NotFoundException(`PatientProfile ${run.patientId} not found`);
    const graph = decodeGraph(workflow.graph, workflow.id);
    return { run, workflow, patient, graph };
  }

  /**
   * Translate Advance/Run errors raised by the shared `applyRunAdvance` and
   * the local `resolveAdvance` into HTTP responses. Pulled out of `advance()`
   * because the nested try/catch was the noisiest part of the file.
   */
  private runAdvanceTransition(
    graph: Parameters<typeof applyRunAdvance>[0],
    history: RunHistoryEntry[],
    nodeId: string,
    outcome: string | undefined,
  ) {
    try {
      const applied = applyRunAdvance(
        graph,
        history,
        nodeId,
        outcome,
        (ctx) => {
          try {
            return resolveAdvance(ctx);
          } catch (e) {
            if (e instanceof AdvanceError) {
              throw new HttpException(
                {
                  statusCode: e.status,
                  errors: [{ code: e.code, message: e.message, ...e.detail }],
                  warnings: [],
                },
                e.status,
              );
            }
            throw e;
          }
        },
      );
      return { history: applied.history, focusNodeId: applied.focusNodeId };
    } catch (e) {
      if (e instanceof AdvanceRunError) {
        throw new BadRequestException(e.message);
      }
      throw e;
    }
  }
}
