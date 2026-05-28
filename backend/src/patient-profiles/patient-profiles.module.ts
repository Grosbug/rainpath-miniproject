import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { PatientProfilesController } from './patient-profiles.controller'
import { PatientProfilesService } from './patient-profiles.service'

@Module({
  imports: [PrismaModule],
  controllers: [PatientProfilesController],
  providers: [PatientProfilesService]
})
export class PatientProfilesModule {}
