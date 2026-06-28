import { Injectable, Logger } from '@nestjs/common';
import { ScraperService } from '../scraper/scraper.service';
import { MatchingService } from '../matching/matching.service';
import { MailService } from '../mail/mail.service';
import { ResumeParserService } from '../scraper/resume-parser.service';
import { Job, MatchedJob, UserProfile } from '../common/interfaces/job.interface';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly scraperService: ScraperService,
    private readonly matchingService: MatchingService,
    private readonly mailService: MailService,
    private readonly resumeParserService: ResumeParserService,
  ) {}

  async fetchAndMatchJobs(
    resumeFile: Express.Multer.File,
    userEmail?: string,
    userName?: string
  ): Promise<{ message?: string; jobs: MatchedJob[] }> {
    let tempFilePath = '';
    
    try {
      this.logger.log(`Starting dynamic job aggregation process for ${userEmail || 'unknown'}...`);

      // 1. Parse Resume Dynamically
      const userProfile = await this.resumeParserService.parseResume(resumeFile.buffer, userEmail, userName);
      
      // 2. Save profile to a temporary JSON file for the Python script
      const dataDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const uniqueId = randomUUID();
      tempFilePath = path.join(dataDir, `user-profile-${uniqueId}.json`);
      fs.writeFileSync(tempFilePath, JSON.stringify(userProfile, null, 2), 'utf-8');

      // Fallback 60s timeout in case Python script hangs completely
      let timeoutHandle: NodeJS.Timeout;
      const timeoutPromise = new Promise<Job[]>((resolve) => {
        timeoutHandle = setTimeout(() => {
          this.logger.warn('60-second fallback timeout reached in Node!');
          resolve([]);
        }, 60000);
      });

      // 3. Run live scrape passing the temp file path
      const freshJobs = await Promise.race([
        this.scraperService.scrapeAll(tempFilePath),
        timeoutPromise
      ]);
      
      clearTimeout(timeoutHandle!); // Clean up timer to prevent false warnings
      this.logger.log(`Scraped ${freshJobs.length} fresh jobs.`);

      if (freshJobs.length === 0) {
        this.logger.warn('Scraper returned 0 jobs. Returning empty result.');
        return { message: "No jobs found in that 60 sec for that resume.", jobs: [] };
      }

      // 4. Deduplicate within this batch to avoid showing the exact same job twice
      const uniqueJobs: Job[] = [];
      const uniqueIdsInThisBatch = new Set<string>();

      for (const job of freshJobs) {
        if (!uniqueIdsInThisBatch.has(job.id)) {
          uniqueJobs.push(job);
          uniqueIdsInThisBatch.add(job.id);
        }
      }

      // 5. Match jobs
      const matchedJobs = this.matchingService.matchJobs(uniqueJobs, userProfile);
      
      if (matchedJobs.length === 0) {
        return { message: "No jobs found in that 60 sec for that resume.", jobs: [] };
      }

      // 6. Send email
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
    } finally {
      // 7. Cleanup the temporary profile JSON
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (e) {
          this.logger.warn(`Failed to cleanup temp profile: ${e.message}`);
        }
      }
    }
  }
}
