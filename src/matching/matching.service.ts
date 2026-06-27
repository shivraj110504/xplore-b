import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { Job, MatchedJob, UserProfile } from '../common/interfaces/job.interface';

@Injectable()
export class MatchingService {
  matchJobs(jobs: Job[], profile: UserProfile): MatchedJob[] {
    const allSkills = [
      ...profile.skills.languages,
      ...profile.skills.frontend,
      ...profile.skills.backend,
      ...profile.skills.databases,
      ...profile.skills.tools,
      ...profile.skills.additional,
    ].map(s => this.normalizeSkill(s));

    const prioritySkills = (profile.matchingConfig.prioritySkills || []).map(s => this.normalizeSkill(s));
    const excludedKeywords = (profile.matchingConfig.excludedKeywords || []).map(s => s.toLowerCase());
    const minScore = profile.matchingConfig.minimumMatchScore || 0;

    // Date filter: 10 days
    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

    return jobs
      .map((job) => {
        // 1. Freshness Filter
        if (job.postedAt) {
          const postedDate = new Date(job.postedAt);
          if (postedDate < tenDaysAgo) {
            return null; // Too old
          }
        }

        // 2. Hard India/Remote Location Gate — drop all non-India, non-remote jobs
        if (!this.isIndiaOrRemoteLocation(job.location)) {
          return null;
        }

        const jobTitleLower = job.title.toLowerCase();
        const descriptionText = this.stripHtml(job.description).toLowerCase();
        const fullText = `${jobTitleLower} ${descriptionText}`;

        // 3. Excluded keywords check
        const isExcluded = excludedKeywords.some((keyword) =>
          jobTitleLower.includes(keyword),
        );
        if (isExcluded) return null;

        // 4. Match Skills
        const matchedSkills = allSkills.filter((skill) =>
          fullText.includes(skill) ||
          (skill === 'react' && fullText.includes('react.js')) ||
          (skill === 'node' && fullText.includes('node.js'))
        );
        const matchedPrioritySkills = prioritySkills.filter((skill) =>
          fullText.includes(skill) ||
          (skill === 'react' && fullText.includes('react.js')) ||
          (skill === 'node' && fullText.includes('node.js'))
        );

        const commonTechSkills = [
          'react', 'node', 'next', 'nest', 'angular', 'vue', 'express', 'django', 'flask', 'spring',
          'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'ruby', 'go', 'rust', 'php',
          'mongodb', 'postgres', 'mysql', 'redis', 'elasticsearch', 'docker', 'kubernetes', 'aws', 'azure', 'gcp',
          'html', 'css', 'sass', 'tailwind', 'graphql', 'rest', 'git', 'linux'
        ];

        const jobSkills = commonTechSkills.filter((skill) =>
          fullText.includes(skill) ||
          (skill === 'react' && fullText.includes('react.js')) ||
          (skill === 'node' && fullText.includes('node.js'))
        );

        // Find skills required by the job that are NOT present in the user's resume
        const missingSkills = jobSkills.filter(
          (skill) => !allSkills.includes(skill)
        );

        // 5. Score Calculation
        let matchScore = 0;

        // Skill Score (max 60 points)
        if (jobSkills.length > 0) {
          // How many of the job's required skills does the user have?
          const matchedJobSkills = jobSkills.filter(skill => allSkills.includes(skill));
          const skillRatio = matchedJobSkills.length / jobSkills.length;
          
          // Base points on percentage of job skills met (up to 50 points)
          matchScore += Math.round(skillRatio * 50);
          
          // Bonus points (up to 10 points) if they have priority skills that match the job
          const matchedPriority = prioritySkills.filter(skill => jobSkills.includes(skill));
          if (prioritySkills.length > 0 && matchedPriority.length > 0) {
            matchScore += 10;
          }
        } else {
          // If the JD had no recognized tech skills, but matched some general keywords
          if (matchedSkills.length > 0) {
            matchScore += Math.min(60, matchedSkills.length * 15);
          }
        }

        // Role Score (max 25 points)
        const preferredRoles = profile.preferences.preferredRoles.map(r => r.toLowerCase());
        const isDevRole = preferredRoles.some(r => r.includes('developer') || r.includes('engineer') || r.includes('software'));

        const roleMatch = preferredRoles.some((role) => jobTitleLower.includes(role)) ||
                          (isDevRole && (jobTitleLower.includes('engineer') || jobTitleLower.includes('developer')));

        if (roleMatch) matchScore += 25;

        // Internship Bonus
        if (profile.preferences.jobTypes?.includes('Internship') && jobTitleLower.includes('intern')) {
          matchScore += 10;
        }

        // Location Score (max 15 points) — tiered India city priority
        // Pune (1st) > Mumbai (2nd) > Bengaluru/Bangalore (3rd) > other India > Remote
        const jobLoc = job.location.toLowerCase();
        let locationScore = 0;

        if (jobLoc.includes('pune')) {
          locationScore = 15; // Highest priority
        } else if (jobLoc.includes('mumbai')) {
          locationScore = 13; // Second priority
        } else if (jobLoc.includes('bengaluru') || jobLoc.includes('bangalore')) {
          locationScore = 11; // Third priority
        } else if (
          jobLoc.includes('hyderabad') || jobLoc.includes('delhi') ||
          jobLoc.includes('gurgaon') || jobLoc.includes('gurugram') ||
          jobLoc.includes('noida') || jobLoc.includes('chennai') ||
          jobLoc.includes('kolkata') || jobLoc.includes('india')
        ) {
          locationScore = 8; // Other India cities
        } else if (
          jobLoc.includes('remote') || jobLoc.includes('anywhere') ||
          jobLoc.includes('distributed') || jobLoc.includes('work from home') ||
          jobLoc.includes('wfh')
        ) {
          locationScore = 5; // Remote — valid but below on-site India
        }

        matchScore += locationScore;
        matchScore = Math.min(matchScore, 100);

        return {
          ...job,
          matchScore,
          matchedSkills: matchedSkills.map(s => this.capitalize(s)),
          missingSkills: missingSkills.map(s => this.capitalize(s)),
        };
      })
      .filter((job): job is MatchedJob => job !== null && job.matchScore >= (minScore > 0 ? minScore - 15 : 0))
      .sort((a, b) => {
        // Primary sort: matchScore descending
        if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
        
        // Secondary sort: Platform/Source priority
        const sourceDiff = this.getSourcePriority(a.source) - this.getSourcePriority(b.source);
        if (sourceDiff !== 0) return sourceDiff;

        // Tertiary sort: location priority ascending (Pune=1 beats Mumbai=2 at equal score)
        return this.getLocationPriority(a.location) - this.getLocationPriority(b.location);
      });
  }

  /**
   * Returns sort-order integer for platform source priority.
   * Indeed=1, Naukri=2, LinkedIn=3, Glassdoor=4, Internshala=5, Apna=6.
   */
  private getSourcePriority(source: string): number {
    const s = (source || '').toLowerCase();
    if (s.includes('indeed')) return 1;
    if (s.includes('naukri')) return 2;
    if (s.includes('linkedin')) return 3;
    if (s.includes('glassdoor')) return 4;
    if (s.includes('internshala')) return 5;
    if (s.includes('apna')) return 6;
    return 7;
  }

  /**
   * Returns sort-order integer for location priority (lower = higher priority).
   * Pune=1, Mumbai=2, Bengaluru/Bangalore=3, other India=4, Remote=5.
   */
  private getLocationPriority(location: string): number {
    const loc = (location || '').toLowerCase();
    if (loc.includes('pune')) return 1;
    if (loc.includes('mumbai')) return 2;
    if (loc.includes('bengaluru') || loc.includes('bangalore')) return 3;
    if (
      loc.includes('hyderabad') || loc.includes('delhi') ||
      loc.includes('gurgaon') || loc.includes('gurugram') ||
      loc.includes('noida') || loc.includes('chennai') ||
      loc.includes('kolkata') || loc.includes('india')
    ) return 4;
    return 5; // Remote / unknown
  }

  /**
   * Hard gate: returns true only for India cities or remote/distributed positions.
   */
  private isIndiaOrRemoteLocation(location: string): boolean {
    if (!location) return false;
    const loc = location.toLowerCase();
    const indiaKeywords = [
      'india', 'pune', 'mumbai', 'bengaluru', 'bangalore', 'hyderabad',
      'delhi', 'gurgaon', 'gurugram', 'noida', 'chennai', 'kolkata',
      'remote', 'anywhere', 'distributed', 'work from home', 'wfh',
    ];
    return indiaKeywords.some((kw) => loc.includes(kw));
  }

  private normalizeSkill(skill: string): string {
    let s = skill.toLowerCase();
    if (s === 'react.js') return 'react';
    if (s === 'node.js') return 'node';
    if (s === 'next.js') return 'next';
    if (s === 'nest.js') return 'nest';
    return s;
  }

  private stripHtml(html: string): string {
    const $ = cheerio.load(html);
    return $.text();
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
