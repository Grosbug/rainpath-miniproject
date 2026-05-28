import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import * as express from 'express'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma/prisma.service'
import { ZodExceptionFilter } from '../src/validation/zod-exception.filter'

export async function buildTestApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
  const app = moduleRef.createNestApplication({ bodyParser: false })
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true, limit: '1mb' }))
  app.setGlobalPrefix('api')
  app.useGlobalFilters(new ZodExceptionFilter())
  await app.init()
  return { app, prisma: app.get(PrismaService) }
}

export async function resetTables(prisma: PrismaService) {
  await prisma.patientRun.deleteMany()
  await prisma.patientProfile.deleteMany()
  await prisma.workflow.deleteMany()
  await prisma.nodeTemplate.deleteMany()
}
