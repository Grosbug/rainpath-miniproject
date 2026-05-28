import { Module } from '@nestjs/common'
import { PrismaModule } from './prisma/prisma.module'
import { WorkflowsModule } from './workflows/workflows.module'
import { NodeTemplatesModule } from './node-templates/node-templates.module'

@Module({
  imports: [PrismaModule, WorkflowsModule, NodeTemplatesModule]
})
export class AppModule {}
