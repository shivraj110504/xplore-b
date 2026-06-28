import { Injectable, Logger } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import { UserProfile } from '../common/interfaces/job.interface';

@Injectable()
export class ResumeParserService {
  private readonly logger = new Logger(ResumeParserService.name);

  // Common tech stack keywords for basic parsing without AI
  private readonly SKILL_KEYWORDS = {
    languages: ['javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'ruby', 'go', 'php', 'swift', 'kotlin', 'rust'],
    frontend: ['react', 'angular', 'vue', 'next.js', 'html', 'css', 'tailwind', 'sass', 'bootstrap', 'svelte', 'react native'],
    backend: ['node.js', 'express', 'nestjs', 'django', 'flask', 'spring boot', 'asp.net', 'laravel', 'ruby on rails'],
    databases: ['mysql', 'postgresql', 'mongodb', 'redis', 'sqlite', 'oracle', 'sql server', 'cassandra', 'elasticsearch', 'dynamodb'],
    tools: ['git', 'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'jenkins', 'github actions', 'linux', 'jira']
  };

  async parseResume(buffer: Buffer, email?: string, name?: string): Promise<UserProfile> {
    try {
      this.logger.log('Starting basic PDF extraction...');
      const parser = new PDFParse({ data: buffer });
      const data = await parser.getText();
      const text = data.text.toLowerCase();

      // Extract skills
      const extractedLanguages = this.extractCategory(text, this.SKILL_KEYWORDS.languages);
      const extractedFrontend = this.extractCategory(text, this.SKILL_KEYWORDS.frontend);
      const extractedBackend = this.extractCategory(text, this.SKILL_KEYWORDS.backend);
      const extractedDatabases = this.extractCategory(text, this.SKILL_KEYWORDS.databases);
      const extractedTools = this.extractCategory(text, this.SKILL_KEYWORDS.tools);

      // Determine preferred roles based on extracted skills
      const preferredRoles: string[] = [];
      if (extractedFrontend.includes('react') || extractedBackend.includes('node.js') || extractedFrontend.includes('angular')) {
        preferredRoles.push('Full Stack Developer', 'Software Engineer');
      }
      if (extractedFrontend.length > 0) preferredRoles.push('Frontend Developer');
      if (extractedBackend.length > 0) preferredRoles.push('Backend Developer');
      if (preferredRoles.length === 0) preferredRoles.push('Software Developer'); // fallback

      // Build UserProfile format
      const profile: UserProfile = {
        personalInfo: {
          name: name || 'User',
          email: email || 'user@example.com',
          phone: '',
          location: 'Remote',
          linkedin: '',
          github: '',
          portfolio: ''
        },
        preferences: {
          preferredRoles: [...new Set(preferredRoles)],
          preferredLocations: ['Remote', 'India'],
          jobTypes: ['Full-time', 'Internship']
        },
        skills: {
          languages: extractedLanguages,
          frontend: extractedFrontend,
          backend: extractedBackend,
          databases: extractedDatabases,
          tools: extractedTools,
          additional: []
        },
        matchingConfig: {
          prioritySkills: [...extractedFrontend.slice(0,2), ...extractedBackend.slice(0,2)],
          excludedKeywords: [],
          minimumMatchScore: 20
        }
      };

      this.logger.log(`Parsed skills: ${JSON.stringify(profile.skills)}`);
      return profile;

    } catch (error) {
      this.logger.error(`Error parsing PDF resume: ${error.message}`);
      throw new Error('Failed to parse resume PDF. Please ensure it is a valid PDF file.');
    }
  }

  private extractCategory(text: string, keywords: string[]): string[] {
    const found = new Set<string>();
    for (const keyword of keywords) {
      // Escape all special regex characters (e.g. +, #, .)
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Use (^|\W) instead of \b because \b fails when the keyword ends in a non-word char like + or #
      const regex = new RegExp(`(^|\\W)${escaped}($|\\W)`, 'i');
      if (regex.test(text)) {
        // Original casing (capitalize first letter usually, except some like 'Next.js')
        const formatted = keyword === 'node.js' ? 'Node.js' : 
                          keyword === 'next.js' ? 'Next.js' : 
                          keyword === 'c++' ? 'C++' :
                          keyword === 'c#' ? 'C#' :
                          keyword === 'php' ? 'PHP' :
                          keyword === 'aws' ? 'AWS' :
                          keyword === 'gcp' ? 'GCP' :
                          keyword.charAt(0).toUpperCase() + keyword.slice(1);
        found.add(formatted);
      }
    }
    return Array.from(found);
  }
}
