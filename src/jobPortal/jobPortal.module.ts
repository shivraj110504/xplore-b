import { Module } from '@nestjs/common';
import { JobPortalService } from './jobPortal.service';
import { JobPortalController } from './jobPortal.controller';

@Module({
  controllers: [JobPortalController],
  providers: [JobPortalService],
})
export class JobPortalModule {}
