import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { MatchedJob } from '../common/interfaces/job.interface';

@ApiTags('Jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get('fetch-all')
  @ApiOperation({ summary: 'Fetch all jobs, normalize, store, and match against user profile' })
  @ApiResponse({ status: 200, description: 'List of matched jobs sorted by score' })
  async fetchAll(): Promise<{ message?: string; jobs: MatchedJob[] }> {
    return this.jobsService.fetchAndMatchJobs();
  }
}
