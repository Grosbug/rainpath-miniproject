import { Injectable, NotFoundException } from '@nestjs/common'
import {
  CHANNEL_STATUSES,
  CreateNodeTemplateDto,
  DataAvailableExpressions,
  NodeTemplate,
  NodeTemplateBody,
  UpdateNodeTemplateDto
} from '@rainpath/shared'
import { PrismaService, buildSoftDeleteClient } from '../prisma/prisma.service'
import { GraphErrorItem, GraphValidationError } from '../validation/graph-validation.error'
import { formatZodError } from '../validation/format-zod-error'

@Injectable()
export class NodeTemplatesService {
  private readonly db: ReturnType<typeof buildSoftDeleteClient>

  constructor(private readonly prisma: PrismaService) {
    this.db = buildSoftDeleteClient(prisma)
  }

  async list(): Promise<NodeTemplate[]> {
    const rows = await this.db.nodeTemplate.findMany({
      orderBy: [{ kind: 'asc' }, { name: 'asc' }]
    })
    return rows.map(r => this.toResponse(r))
  }

  async get(id: string): Promise<NodeTemplate> {
    const row = await this.db.nodeTemplate.findUnique({ where: { id } })
    if (!row) throw new NotFoundException(`Template ${id} not found`)
    return this.toResponse(row)
  }

  async create(dto: CreateNodeTemplateDto): Promise<NodeTemplate> {
    const body = this.parseBody({ kind: (dto as any).kind, params: (dto as any).params })
    this.validateChannelRules(body)
    const row = await this.prisma.nodeTemplate.create({
      data: {
        name: (dto as any).name,
        description: (dto as any).description ?? null,
        kind: body.kind,
        params: JSON.stringify(body.params)
      }
    })
    return this.toResponse(row)
  }

  async update(id: string, dto: UpdateNodeTemplateDto): Promise<NodeTemplate> {
    const existing = await this.db.nodeTemplate.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Template ${id} not found`)

    const data: Record<string, unknown> = {}
    if (dto.name !== undefined) data.name = dto.name
    if (dto.description !== undefined) data.description = dto.description

    if (dto.params !== undefined) {
      const body = this.parseBody({ kind: existing.kind, params: dto.params })
      this.validateChannelRules(body)
      data.params = JSON.stringify(body.params)
    }

    const row = await this.prisma.nodeTemplate.update({ where: { id }, data })
    return this.toResponse(row)
  }

  async softDelete(id: string): Promise<void> {
    const existing = await this.db.nodeTemplate.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Template ${id} not found`)
    await this.prisma.nodeTemplate.update({
      where: { id },
      data: { deletedAt: new Date() }
    })
  }

  /** Discriminated-union parse: kind + params must be coherent. */
  private parseBody(input: { kind: unknown; params: unknown }) {
    const result = NodeTemplateBody.safeParse(input)
    if (!result.success) {
      throw new GraphValidationError(
        formatZodError(result.error).map(i => ({
          code: i.code,
          message: i.message
        }))
      )
    }
    return result.data
  }

  /**
   * Cross-channel rules that Zod alone cannot enforce (spec §5.5):
   * - statuses must belong to the channel
   * - postal untracked must be single
   * - data_available expression must be a known patient field
   * - multi outputs must not overlap on statuses
   */
  private validateChannelRules(body: ReturnType<NodeTemplatesService['parseBody']>) {
    const errors: GraphErrorItem[] = []

    if (body.kind === 'condition') {
      if (body.params.conditionType === 'data_available') {
        if (!DataAvailableExpressions.includes(body.params.expression as any)) {
          errors.push({
            code: 'unknown_data_available_expression',
            message: `expression must be one of ${DataAvailableExpressions.join(', ')}`
          })
        }
      }
    } else {
      let channelKey: keyof typeof CHANNEL_STATUSES
      if (body.kind === 'send_email') channelKey = 'email'
      else if (body.kind === 'send_sms') channelKey = 'sms'
      else if (body.kind === 'send_whatsapp') channelKey = 'whatsapp'
      else channelKey = body.params.tracked ? 'postal_tracked' : 'postal_untracked'

      const allowed = new Set<string>(CHANNEL_STATUSES[channelKey])

      if (body.kind === 'send_postal' && !body.params.tracked && body.params.output.mode !== 'single') {
        errors.push({ code: 'postal_untracked_must_be_single', message: 'postal_untracked must use mode=single' })
      }

      const output = body.params.output
      if (output.mode === 'simple') {
        for (const s of output.successCondition.statuses) {
          if (!allowed.has(s)) errors.push({ code: 'status_not_in_channel', message: `status ${s} not in ${channelKey}` })
        }
      } else if (output.mode === 'multi') {
        const seen = new Set<string>()
        for (const out of output.outputs) {
          for (const s of out.condition.statuses) {
            if (!allowed.has(s)) errors.push({ code: 'status_not_in_channel', message: `status ${s} not in ${channelKey}` })
            if (seen.has(s)) errors.push({ code: 'status_overlap_in_multi', message: `status ${s} appears in more than one output` })
            seen.add(s)
          }
        }
      }
    }

    if (errors.length > 0) throw new GraphValidationError(errors)
  }

  private toResponse(row: {
    id: string
    name: string
    description: string | null
    kind: string
    params: string
    createdAt: Date
    updatedAt: Date
  }): NodeTemplate {
    const params = JSON.parse(row.params)
    const parsed = NodeTemplate.safeParse({
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      kind: row.kind,
      params,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    })
    if (!parsed.success) {
      throw new GraphValidationError(
        formatZodError(parsed.error).map(i => ({ code: i.code, message: `Stored template ${row.id} drift: ${i.message}` }))
      )
    }
    return parsed.data
  }
}
