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
export class LeverProvider {
  private readonly baseUrl = 'https://api.lever.co/v0/postings';

  async fetchJobs(company: string): Promise<Job[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/${company}?mode=json`);
      const jobs = response.data || [];

      return jobs
        .map((job: any) => ({
          id: `lever-${job.id}`,
          title: job.text,
          company: company.charAt(0).toUpperCase() + company.slice(1),
          location: job.categories?.location || 'Remote',
          applyLink: job.applyUrl,
          description: job.description + (job.lists?.map((l: any) => l.text + l.content).join(' ') || ''),
          source: 'Lever' as const,
          postedAt: new Date(job.createdAt).toISOString(),
        }))
        .filter((job) => isIndiaOrRemoteLocation(job.location));
    } catch (error) {
      console.error(`Error fetching Lever jobs for ${company}:`, error.message);
      return [];
    }
  }
}
