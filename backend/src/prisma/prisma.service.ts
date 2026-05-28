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

/**
 * Extended Prisma client that auto-filters soft-deleted rows on findMany/findFirst/findUnique.
 * Use `prismaWithSoftDelete` in services that should never see deleted rows.
 */
export function buildSoftDeleteClient(base: PrismaService) {
  return base.$extends({
    query: {
      $allModels: {
        async findMany({ args, query }) {
          args.where = { ...args.where, deletedAt: null }
          return query(args)
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, deletedAt: null }
          return query(args)
        },
        async findUnique({ args, query }) {
          args.where = { ...args.where, deletedAt: null }
          return query(args)
        }
      }
    }
  })
}
