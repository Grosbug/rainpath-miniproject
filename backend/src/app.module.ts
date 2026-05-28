import { Module } from '@nestjs/common'
import { PrismaModule } from './prisma/prisma.module'
import { WorkflowsModule } from './workflows/workflows.module'
import { NodeTemplatesModule } from './node-templates/node-templates.module'
import { PatientProfilesModule } from './patient-profiles/patient-profiles.module'
import { PatientRunsModule } from './patient-runs/patient-runs.module'

@Module({
  imports: [
    PrismaModule,
    WorkflowsModule,
    NodeTemplatesModule,
    PatientProfilesModule,
    PatientRunsModule
  ]
})
export class AppModule {}
