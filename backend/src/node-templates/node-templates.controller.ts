import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UsePipes } from '@nestjs/common'
import { CreateNodeTemplateDto, UpdateNodeTemplateDto } from '@rainpath/shared'
import { ZodValidationPipe } from '../validation/zod-validation.pipe'
import { NodeTemplatesService } from './node-templates.service'

@Controller('node-templates')
export class NodeTemplatesController {
  constructor(private readonly service: NodeTemplatesService) {}

  @Get()
  list() {
    return this.service.list()
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id)
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreateNodeTemplateDto))
  create(@Body() body: CreateNodeTemplateDto) {
    return this.service.create(body)
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(UpdateNodeTemplateDto))
  update(@Param('id') id: string, @Body() body: UpdateNodeTemplateDto) {
    return this.service.update(id, body)
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.service.softDelete(id)
  }
}
