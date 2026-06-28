import { Injectable, Logger } from '@nestjs/common';
import { JsonStorageUtil } from '../../common/utils/json-storage.util';
import { Job } from '../../common/interfaces/job.interface';
import { spawn } from 'child_process';
import * as path from 'path';

@Injectable()
export class UniversalProvider {
  private readonly logger = new Logger(UniversalProvider.name);
  private activeScrapePromise: Promise<Job[]> | null = null;

  async fetchJobs(tempFilePath?: string): Promise<Job[]> {
    if (this.activeScrapePromise) {
      this.logger.log('Scrape already in progress. Joining existing scrape pool...');
      return this.activeScrapePromise;
    }

    // 1. Run the Python scraper to get fresh jobs across all platforms
    this.activeScrapePromise = this.runPythonScraper(tempFilePath)
      .catch((e) => {
        this.logger.error(`Failed to fetch universal jobs: ${e.message}`);
        return [];
      })
      .finally(() => {
        this.activeScrapePromise = null;
      });

    return this.activeScrapePromise;
  }

  /**
   * Spawns the Python scraper as a child process.
   * Resolves when the process exits (success or failure — we never block the pipeline).
   */
  private runPythonScraper(tempFilePath?: string): Promise<Job[]> {
    return new Promise((resolve) => {
      const scriptPath = path.join(process.cwd(), 'scripts', 'job_scraper.py');
      this.logger.log('Running Python job scraper...');

      // Try `python` first (Windows default), fall back to `python3`
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      const args = tempFilePath ? [scriptPath, tempFilePath] : [scriptPath];
      
      const child = spawn(pythonCmd, args, {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => {
        const line = d.toString().trim();
        if (line) this.logger.debug(`[PY] ${line}`);
        stderr += line + '\n';
      });

      child.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout.trim());
            if (Array.isArray(result)) {
              this.logger.log(`Python scraper done → ${result.length} jobs retrieved`);
              resolve(result);
            } else {
              this.logger.warn('Python scraper did not return an array');
              resolve([]);
            }
          } catch (e) {
            this.logger.error(`Python scraper output parse error: ${e.message}`);
            resolve([]);
          }
        } else {
          this.logger.warn(`Python scraper exited with code ${code}.`);
          resolve([]);
        }
      });

      child.on('error', (err) => {
        this.logger.warn(`Python scraper could not start: ${err.message}. Using previous external-jobs.json.`);
        resolve([]);
      });
    });
  }
}
