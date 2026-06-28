import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { MatchedJob } from '../common/interfaces/job.interface';

@Injectable()
export class MailService {
  private readonly resend: Resend;
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn('RESEND_API_KEY not found in configuration. Email sending will be disabled.');
    }
  }

  async sendJobAlert(email: string, userName: string, jobs: MatchedJob[]) {
    if (!this.resend) {
      this.logger.error('Resend client not initialized. Check RESEND_API_KEY.');
      return;
    }

    // Increased to 30 matches in email
    const jobRows = jobs.slice(0, 30).map(job => `
      <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #333; border-radius: 8px; background: #1a1a1a;">
        <h3 style="color: #0891b2; margin: 0 0 5px 0;">${job.title}</h3>
        <p style="color: #fff; margin: 0 0 10px 0;"><strong>Company:</strong> ${job.company} | <strong>Location:</strong> ${job.location}</p>
        <p style="color: #ccc; margin: 0 0 10px 0;"><strong>Match Score:</strong> ${job.matchScore}%</p>
        <a href="${job.applyLink}" style="display: inline-block; padding: 10px 20px; background: #0891b2; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold;">Apply Now</a>
      </div>
    `).join('');

    try {
      // 1. Send to User (without Admin Note)
      await this.resend.emails.send({
        from: 'Job Aggregator <jobs@shivrajtaware.in>',
        to: email,
        subject: `New Job Matches for ${userName}!`,
        html: `
          <body style="font-family: Arial, sans-serif; background: #000; padding: 20px; color: #d1d5db;">
            <div style="max-width: 600px; margin: 0 auto; background: #111; border-radius: 16px; padding: 30px; border: 1px solid #333;">
              <h1 style="color: #0891b2; text-align: center; margin-bottom: 30px;">Your Daily Job Brief</h1>
              <p style="font-size: 16px; line-height: 1.6;">Hello ${userName},</p>
              <p style="font-size: 16px; line-height: 1.6;">We found <strong>${jobs.length}</strong> new jobs that match your profile. Here are the top matches:</p>
              
              <div style="margin-top: 30px;">
                ${jobRows}
              </div>

              <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #333;">
                <p style="font-size: 14px; color: #6b7280;">Stay informed, stay empowered.<br><strong>Job Aggregator Team</strong></p>
              </div>
            </div>
          </body>
        `,
      });

      // 2. Send to Admin (with Admin Note)
      await this.resend.emails.send({
        from: 'Job Aggregator <jobs@shivrajtaware.in>',
        to: 'shivarajtaware7192@gmail.com',
        subject: `[ADMIN ALERT] Job Search triggered by ${userName} (${email})`,
        html: `
          <body style="font-family: Arial, sans-serif; background: #000; padding: 20px; color: #d1d5db;">
            <div style="max-width: 600px; margin: 0 auto; background: #111; border-radius: 16px; padding: 30px; border: 1px solid #333;">
              <p style="color: #ef4444; font-size: 14px; text-align: center; margin-bottom: 20px;"><strong>ADMIN NOTE: Search triggered by ${userName} (${email})</strong></p>
              <h1 style="color: #0891b2; text-align: center; margin-bottom: 30px;">Your Daily Job Brief</h1>
              <p style="font-size: 16px; line-height: 1.6;">Hello ${userName},</p>
              <p style="font-size: 16px; line-height: 1.6;">We found <strong>${jobs.length}</strong> new jobs that match your profile. Here are the top matches:</p>
              
              <div style="margin-top: 30px;">
                ${jobRows}
              </div>

              <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #333;">
                <p style="font-size: 14px; color: #6b7280;">Stay informed, stay empowered.<br><strong>Job Aggregator Team</strong></p>
              </div>
            </div>
          </body>
        `,
      });

      this.logger.log(`✅ Job alert emails sent to ${email} and Admin`);
    } catch (error) {
      this.logger.error(`❌ Failed to send emails: ${error.message}`);
    }
  }
}
