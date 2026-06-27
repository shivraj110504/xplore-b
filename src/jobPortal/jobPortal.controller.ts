import { Controller } from '@nestjs/common';
import { JobPortalService } from './jobPortal.service';

@Controller('job-portal')
export class JobPortalController {
  constructor(private readonly jobPortalService: JobPortalService) {}
}
