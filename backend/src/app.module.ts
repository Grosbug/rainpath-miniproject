import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './prisma/prisma.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { NodeTemplatesModule } from './node-templates/node-templates.module';
import { PatientProfilesModule } from './patient-profiles/patient-profiles.module';
import { PatientRunsModule } from './patient-runs/patient-runs.module';
import { HealthModule } from './health/health.module';

const isPretty = process.env.LOG_PRETTY === 'true';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        // Avoid binding pino-pretty unconditionally — it pulls a heavyweight
        // dependency tree (sonic-boom, fast-redact, ...) at boot. Only require
        // it when LOG_PRETTY is set, leaving prod on the default JSON pipeline.
        transport: isPretty
          ? { target: 'pino-pretty', options: { singleLine: true } }
          : undefined,
        // Drop the healthcheck noise — every probe would otherwise flood logs.
        autoLogging: {
          ignore: (req) => req.url === '/api/health',
        },
        // Strip header bodies that frequently contain secrets when forwarded.
        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie'],
          remove: true,
        },
      },
    }),
    PrismaModule,
    WorkflowsModule,
    NodeTemplatesModule,
    PatientProfilesModule,
    PatientRunsModule,
    HealthModule,
  ],
})
export class AppModule {}
