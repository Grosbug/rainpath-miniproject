import { Body, Controller, Delete, Get, HttpCode, Param, Post, UsePipes } from '@nestjs/common'
import { AdvancePatientRunDto, CreatePatientRunDto, FocusPatientRunDto } from '@rainpath/shared'
import { ZodValidationPipe } from '../validation/zod-validation.pipe'
import { PatientRunsService } from './patient-runs.service'

@Controller()
export class PatientRunsController {
  constructor(private readonly service: PatientRunsService) {}

  @Get('workflows/:workflowId/patient-runs')
  listForWorkflow(@Param('workflowId') workflowId: string) {
    return this.service.listForWorkflow(workflowId)
  }

  @Get('patient-profiles/:patientId/patient-runs')
  listForPatient(@Param('patientId') patientId: string) {
    return this.service.listForPatient(patientId)
  }

  @Post('workflows/:workflowId/patient-runs')
  @UsePipes(new ZodValidationPipe(CreatePatientRunDto))
  create(@Param('workflowId') workflowId: string, @Body() body: CreatePatientRunDto) {
    return this.service.create(workflowId, body)
  }

  @Get('patient-runs/:id')
  get(@Param('id') id: string) {
    return this.service.get(id)
  }

  @Post('patient-runs/:id/advance')
  @UsePipes(new ZodValidationPipe(AdvancePatientRunDto))
  advance(@Param('id') id: string, @Body() body: AdvancePatientRunDto) {
    return this.service.advance(id, body)
  }

  @Post('patient-runs/:id/focus')
  @UsePipes(new ZodValidationPipe(FocusPatientRunDto))
  focus(@Param('id') id: string, @Body() body: FocusPatientRunDto) {
    return this.service.focus(id, body)
  }

  @Post('patient-runs/:id/reset')
  reset(@Param('id') id: string) {
    return this.service.reset(id)
  }

  @Post('patient-runs/:id/step-back')
  stepBack(@Param('id') id: string) {
    return this.service.stepBack(id)
  }

  @Delete('patient-runs/:id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.service.softDelete(id)
  }
}
