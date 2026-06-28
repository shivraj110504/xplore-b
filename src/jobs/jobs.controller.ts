import { Controller, Post, Body, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiResponse, ApiTags, ApiConsumes } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { MatchedJob } from '../common/interfaces/job.interface';

@ApiTags('Jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post('fetch-all')
  @UseInterceptors(FileInterceptor('resume'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload resume, extract skills, fetch live jobs, and match against user profile' })
  @ApiResponse({ status: 200, description: 'List of matched jobs sorted by score' })
  async fetchAll(
    @UploadedFile() resumeFile: Express.Multer.File,
    @Body('email') email?: string,
    @Body('name') name?: string
  ): Promise<{ message?: string; jobs: MatchedJob[] }> {
    if (!resumeFile) {
      throw new BadRequestException('Resume file is required');
    }
    return this.jobsService.fetchAndMatchJobs(resumeFile, email, name);
  }
}
