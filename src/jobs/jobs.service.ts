import { Injectable, Logger } from '@nestjs/common';
import { ScraperService } from '../scraper/scraper.service';
import { MatchingService } from '../matching/matching.service';
import { MailService } from '../mail/mail.service';
import { JsonStorageUtil } from '../common/utils/json-storage.util';
import { Job, MatchedJob, UserProfile } from '../common/interfaces/job.interface';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly scraperService: ScraperService,
    private readonly matchingService: MatchingService,
    private readonly mailService: MailService,
  ) {}

  async fetchAndMatchJobs(userEmail?: string, userName?: string): Promise<{ message?: string; jobs: MatchedJob[] }> {
    try {
      this.logger.log(`Starting job aggregation process for ${userEmail || 'unknown'}...`);

      // Fallback 60s timeout in case Python script hangs completely
      let timeoutHandle: NodeJS.Timeout;
      const timeoutPromise = new Promise<Job[]>((resolve) => {
        timeoutHandle = setTimeout(() => {
          this.logger.warn('60-second fallback timeout reached in Node!');
          resolve([]);
        }, 60000);
      });

      // 1. Run live scrape
      const freshJobs = await Promise.race([
        this.scraperService.scrapeAll(),
        timeoutPromise
      ]);
      
      clearTimeout(timeoutHandle!); // Clean up timer to prevent false warnings
      this.logger.log(`Scraped ${freshJobs.length} fresh jobs.`);

      if (freshJobs.length === 0) {
        this.logger.warn('Scraper returned 0 jobs. Returning empty result.');
        return { message: "No jobs found in that 60 sec for that resume.", jobs: [] };
      }

      // 2. Deduplicate within this batch to avoid showing the exact same job twice
      const uniqueJobs: Job[] = [];
      const uniqueIdsInThisBatch = new Set<string>();

      for (const job of freshJobs) {
        if (!uniqueIdsInThisBatch.has(job.id)) {
          uniqueJobs.push(job);
          uniqueIdsInThisBatch.add(job.id);
        }
      }

      // 3. Load user profile
      const userProfile = await JsonStorageUtil.readData<UserProfile>('user-profile.json');
      if (!userProfile) {
        return { message: "User profile not found. Please upload a resume.", jobs: [] };
      }

      // 4. Match jobs
      const matchedJobs = this.matchingService.matchJobs(uniqueJobs, userProfile);
      
      if (matchedJobs.length === 0) {
        return { message: "No jobs found in that 60 sec for that resume.", jobs: [] };
      }

      // 7. Send email
      if (matchedJobs.length > 0) {
        const finalEmail = userEmail || userProfile.personalInfo.email;
        const finalName = userName || userProfile.personalInfo.name;
        
        await this.mailService.sendJobAlert(
          finalEmail,
          finalName,
          matchedJobs,
        );
      }

      return { jobs: matchedJobs };
    } catch (error) {
      this.logger.error('Error in fetchAndMatchJobs:', error.stack);
      throw error;
    }
  }
}
