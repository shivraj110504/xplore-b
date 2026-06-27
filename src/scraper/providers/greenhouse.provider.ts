import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { Job } from '../../common/interfaces/job.interface';

// India-relevant location keywords (case-insensitive)
const INDIA_LOCATION_KEYWORDS = [
  'india', 'pune', 'mumbai', 'bengaluru', 'bangalore', 'hyderabad',
  'delhi', 'gurgaon', 'gurugram', 'noida', 'chennai', 'kolkata',
  'remote', 'anywhere', 'distributed', 'work from home', 'wfh',
];

function isIndiaOrRemoteLocation(location: string): boolean {
  if (!location) return false;
  const loc = location.toLowerCase();
  return INDIA_LOCATION_KEYWORDS.some((keyword) => loc.includes(keyword));
}

@Injectable()
export class GreenhouseProvider {
  private readonly baseUrl = 'https://boards-api.greenhouse.io/v1/boards';

  async fetchJobs(company: string): Promise<Job[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/${company}/jobs?content=true`);
      const jobs = response.data.jobs || [];

      return jobs
        .map((job: any) => ({
          id: `greenhouse-${job.id}`,
          title: job.title,
          company: company.charAt(0).toUpperCase() + company.slice(1),
          location: job.location?.name || 'Remote',
          applyLink: job.absolute_url,
          description: job.content || '',
          source: 'Greenhouse' as const,
          postedAt: job.updated_at,
        }))
        .filter((job) => isIndiaOrRemoteLocation(job.location));
    } catch (error) {
      console.error(`Error fetching Greenhouse jobs for ${company}:`, error.message);
      return [];
    }
  }
}
