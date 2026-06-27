export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  applyLink: string;
  description: string;
  source: 'Greenhouse' | 'Lever' | 'SmartRecruiters' | 'LinkedIn' | 'Naukri' | 'Other';
  postedAt?: string;
}

export interface UserProfile {
  personalInfo: {
    name: string;
    email: string;
    phone: string;
    location: string;
    linkedin: string;
    github: string;
    portfolio: string;
  };
  preferences: {
    preferredRoles: string[];
    preferredLocations: string[];
    jobTypes: string[];
  };
  skills: {
    languages: string[];
    frontend: string[];
    backend: string[];
    databases: string[];
    tools: string[];
    additional: string[];
  };
  matchingConfig: {
    prioritySkills: string[];
    excludedKeywords: string[];
    minimumMatchScore: number;
  };
}

export interface MatchedJob extends Job {
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
}
