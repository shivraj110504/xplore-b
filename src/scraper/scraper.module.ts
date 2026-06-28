import { Module } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { GreenhouseProvider } from './providers/greenhouse.provider';
import { LeverProvider } from './providers/lever.provider';
import { SmartRecruitersProvider } from './providers/smartrecruiters.provider';
import { UniversalProvider } from './providers/universal.provider';
import { ResumeParserService } from './resume-parser.service';

@Module({
  providers: [
    ScraperService, 
    GreenhouseProvider, 
    LeverProvider, 
    SmartRecruitersProvider,
    UniversalProvider,
    ResumeParserService
  ],
  exports: [ScraperService, ResumeParserService, UniversalProvider],
})
export class ScraperModule {}
