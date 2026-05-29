import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect()
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}

type SoftDeleteQueryCtx = {
  args: { where?: Record<string, unknown> }
  query: (args: { where?: Record<string, unknown> }) => Promise<unknown>
}

function withSoftDeleteWhere({ args, query }: SoftDeleteQueryCtx) {
  args.where = { ...args.where, deletedAt: null }
  return query(args)
}

/**
 * Extended Prisma client that auto-filters soft-deleted rows on findMany/findFirst/findUnique.
 * Use `prismaWithSoftDelete` in services that should never see deleted rows.
 *
 * Typed as `PrismaService` so callers keep generated model types; `$extends` alone does not
 * preserve them under `noImplicitAny`.
 */
export function buildSoftDeleteClient(base: PrismaService): PrismaService {
  return base.$extends({
    query: {
      $allModels: {
        findMany: withSoftDeleteWhere,
        findFirst: withSoftDeleteWhere,
        findUnique: withSoftDeleteWhere
      }
    }
  }) as unknown as PrismaService
}
