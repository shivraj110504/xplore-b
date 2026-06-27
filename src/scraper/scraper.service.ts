import { Injectable } from '@nestjs/common';
import { GreenhouseProvider } from './providers/greenhouse.provider';
import { LeverProvider } from './providers/lever.provider';
import { SmartRecruitersProvider } from './providers/smartrecruiters.provider';
import { UniversalProvider } from './providers/universal.provider';
import { Job } from '../common/interfaces/job.interface';

@Injectable()
export class ScraperService {
  constructor(
    private readonly greenhouseProvider: GreenhouseProvider,
    private readonly leverProvider: LeverProvider,
    private readonly smartRecruitersProvider: SmartRecruitersProvider,
    private readonly universalProvider: UniversalProvider,
  ) {}

  async scrapeAll(): Promise<Job[]> {
    // 1. External/Deep Search Scraping (LinkedIn, Internshala, etc. via Python)
    const jobs = await this.universalProvider.fetchJobs();

    // Deduplicate by ID
    const uniqueJobs = Array.from(
      new Map(jobs.map((job) => [job.id, job])).values(),
    );

    return uniqueJobs;
  }
}
