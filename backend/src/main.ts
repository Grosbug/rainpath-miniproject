import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import * as express from 'express'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false })

  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true, limit: '1mb' }))

  app.setGlobalPrefix('api')
  app.enableCors({ origin: 'http://localhost:5173' })

  await app.listen(3000)
}
bootstrap()
