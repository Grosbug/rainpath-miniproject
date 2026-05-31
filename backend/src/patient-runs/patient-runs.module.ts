import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PatientRunsController } from './patient-runs.controller';
import { PatientRunsService } from './patient-runs.service';

@Module({
  imports: [PrismaModule],
  controllers: [PatientRunsController],
  providers: [PatientRunsService],
})
export class PatientRunsModule {}
