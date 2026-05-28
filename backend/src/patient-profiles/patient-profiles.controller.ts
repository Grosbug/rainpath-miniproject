import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UsePipes } from '@nestjs/common'
import { CreatePatientProfileDto, UpdatePatientProfileDto } from '@rainpath/shared'
import { ZodValidationPipe } from '../validation/zod-validation.pipe'
import { PatientProfilesService } from './patient-profiles.service'

@Controller('patient-profiles')
export class PatientProfilesController {
  constructor(private readonly service: PatientProfilesService) {}

  @Get()
  list() {
    return this.service.list()
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id)
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreatePatientProfileDto))
  create(@Body() body: CreatePatientProfileDto) {
    return this.service.create(body)
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(UpdatePatientProfileDto))
  update(@Param('id') id: string, @Body() body: UpdatePatientProfileDto) {
    return this.service.update(id, body)
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.service.softDelete(id)
  }
}
