import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import * as express from 'express';
import { AppModule } from './app.module';
import { ZodExceptionFilter } from './validation/zod-exception.filter';

function parseCorsOrigins(raw: string | undefined): string[] {
  return (raw ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function bootstrap() {
  // bufferLogs lets nestjs-pino capture the framework's own startup logs once
  // useLogger is wired below — without it, Nest's default ConsoleLogger spills
  // before pino takes over.
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: parseCorsOrigins(process.env.CORS_ORIGIN),
    credentials: false,
  });
  app.useGlobalFilters(new ZodExceptionFilter());

  // Hook Nest into Node's SIGTERM/SIGINT so onModuleDestroy hooks (Prisma
  // disconnect, etc.) actually run when Kubernetes/Docker stop the container.
  app.enableShutdownHooks();

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
  // Log via the pino instance so the bootstrap line shares structure + level
  // routing with the rest of the app's output.
  app
    .get(Logger)
    .log(`API listening on http://0.0.0.0:${port}/api`, 'Bootstrap');
}
bootstrap();
