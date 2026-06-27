import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { Job } from '../../common/interfaces/job.interface';

// India-relevant location keywords (case-insensitive)
const INDIA_LOCATION_KEYWORDS = [
  'india', 'pune', 'mumbai', 'bengaluru', 'bangalore', 'hyderabad',
  'delhi', 'gurgaon', 'gurugram', 'noida', 'chennai', 'kolkata',
  'remote', 'anywhere', 'distributed',
];

function isIndiaOrRemoteLocation(location: string): boolean {
  if (!location) return false;
  const loc = location.toLowerCase();
  return INDIA_LOCATION_KEYWORDS.some((keyword) => loc.includes(keyword));
}

@Injectable()
export class SmartRecruitersProvider {
  private readonly baseUrl = 'https://api.smartrecruiters.com/v1/companies';

  async fetchJobs(company: string): Promise<Job[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/${company}/postings`);
      const postings = response.data.content || [];

      return postings
        .map((job: any) => ({
          id: `smartrecruiters-${job.id}`,
          title: job.name,
          company: company.charAt(0).toUpperCase() + company.slice(1),
          location: `${job.location?.city || ''}, ${job.location?.country || ''}`.trim().replace(/^,\s*/, ''),
          applyLink: `https://jobs.smartrecruiters.com/${company}/${job.id}`,
          description: '',
          source: 'SmartRecruiters' as const,
          postedAt: job.releasedDate,
        }))
        .filter((job) => isIndiaOrRemoteLocation(job.location));
    } catch (error) {
      // console.error(`Error fetching SmartRecruiters jobs for ${company}:`, error.message);
      return [];
    }
  }
}
