import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UsePipes } from '@nestjs/common'
import {
  CreateWorkflowDto,
  DuplicateWorkflowDto,
  UpdateWorkflowDto
} from '@rainpath/shared'
import { ZodValidationPipe } from '../validation/zod-validation.pipe'
import { WorkflowsService } from './workflows.service'

@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly service: WorkflowsService) {}

  @Get()
  list() {
    return this.service.list()
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id)
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreateWorkflowDto))
  create(@Body() body: CreateWorkflowDto) {
    return this.service.create(body)
  }

  @Post(':id/duplicate')
  @UsePipes(new ZodValidationPipe(DuplicateWorkflowDto))
  duplicate(@Param('id') id: string, @Body() body: DuplicateWorkflowDto) {
    return this.service.duplicate(id, body)
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(UpdateWorkflowDto))
  update(@Param('id') id: string, @Body() body: UpdateWorkflowDto) {
    return this.service.update(id, body)
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.service.softDelete(id)
  }
}
