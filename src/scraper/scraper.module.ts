import { Module } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { GreenhouseProvider } from './providers/greenhouse.provider';
import { LeverProvider } from './providers/lever.provider';
import { SmartRecruitersProvider } from './providers/smartrecruiters.provider';
import { UniversalProvider } from './providers/universal.provider';

@Module({
  providers: [
    ScraperService, 
    GreenhouseProvider, 
    LeverProvider, 
    SmartRecruitersProvider,
    UniversalProvider
  ],
  exports: [ScraperService],
})
export class ScraperModule {}
