import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { ScraperModule } from '../scraper/scraper.module';
import { MatchingModule } from '../matching/matching.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [ScraperModule, MatchingModule, MailModule],
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}
