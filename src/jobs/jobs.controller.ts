import { Controller, Post, Body } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { MatchedJob } from '../common/interfaces/job.interface';

@ApiTags('Jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post('fetch-all')
  @ApiOperation({ summary: 'Fetch all jobs, normalize, store, and match against user profile' })
  @ApiResponse({ status: 200, description: 'List of matched jobs sorted by score' })
  async fetchAll(
    @Body('email') email?: string,
    @Body('name') name?: string
  ): Promise<{ message?: string; jobs: MatchedJob[] }> {
    return this.jobsService.fetchAndMatchJobs(email, name);
  }
}
