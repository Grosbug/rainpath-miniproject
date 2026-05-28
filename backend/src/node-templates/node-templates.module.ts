import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { NodeTemplatesController } from './node-templates.controller'
import { NodeTemplatesService } from './node-templates.service'

@Module({
  imports: [PrismaModule],
  controllers: [NodeTemplatesController],
  providers: [NodeTemplatesService]
})
export class NodeTemplatesModule {}
