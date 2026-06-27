import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JobsModule } from './jobs/jobs.module';
import { ScraperModule } from './scraper/scraper.module';
import { MatchingModule } from './matching/matching.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JobsModule,
    ScraperModule,
    MatchingModule,
    MailModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
