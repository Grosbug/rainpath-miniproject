import 'dotenv/config'
import { NestFactory } from '@nestjs/core'
import * as express from 'express'
import { AppModule } from './app.module'
import { ZodExceptionFilter } from './validation/zod-exception.filter'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false })

  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true, limit: '1mb' }))

  app.setGlobalPrefix('api')
  app.enableCors({ origin: 'http://localhost:5173' })
  app.useGlobalFilters(new ZodExceptionFilter())

  await app.listen(3000)
}
bootstrap()
