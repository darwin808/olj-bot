import { loadConfig } from './config';
import { loadState } from './state';
import { initBrowser, cleanup, takeScreenshot } from './browser';
import { login } from './auth';
import { searchJobs } from './search';
import { applyToJob } from './apply';
import { logger } from './logger';

async function main(): Promise<void> {
  logger.info('='.repeat(50));
  logger.info('OnlineJobs.ph Job Application Automation');
  logger.info('='.repeat(50));

  let page = null;

  try {
    // Load configuration
    const config = loadConfig();

    // Load state (applied jobs history)
    const state = loadState();

    // Initialize browser
    page = await initBrowser(config.headless);

    // Login
    await login(page, config.credentials.email, config.credentials.password);

    let totalApplied = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    // Process each search term
    for (const searchTerm of config.searchTerms) {
      logger.info('-'.repeat(40));
      logger.info(`Processing search term: "${searchTerm}"`);

      // Search for jobs
      const jobs = await searchJobs(
        page,
        searchTerm,
        config.jobsPerSearchTerm,
        config.blockedEmployers,
        state
      );

      if (jobs.length === 0) {
        logger.warn(`No eligible jobs found for "${searchTerm}"`);
        continue;
      }

      // Apply to each job
      for (const job of jobs) {
        // Double-check we haven't applied (in case state changed)
        if (state.hasApplied(job.id)) {
          logger.debug(`Skipping ${job.id} - already applied`);
          totalSkipped++;
          continue;
        }

        const result = await applyToJob(page, job, config.proposal, config.blockedEmployers, config.dryRun);

        const employerName = result.employerName || job.employerName || 'Unknown';

        if (result.skipped) {
          // Blocked employer - skip without marking as applied
          totalSkipped++;
        } else if (result.alreadyApplied) {
          // Mark as applied in our state even if website says already applied
          state.markAsApplied({
            id: job.id,
            title: job.title,
            employerName,
            searchTerm: job.searchTerm,
            url: job.url
          });
          totalSkipped++;
        } else if (result.success) {
          // Mark as applied
          state.markAsApplied({
            id: job.id,
            title: job.title,
            employerName,
            searchTerm: job.searchTerm,
            url: job.url
          });
          totalApplied++;
        } else {
          logger.error(`Failed to apply to ${job.title}: ${result.error || 'Unknown error'}`);
          totalFailed++;
        }

        // Rate limiting - wait between applications
        await page.waitForTimeout(2000);
      }
    }

    // Summary
    logger.info('='.repeat(50));
    logger.info('SUMMARY');
    logger.info('='.repeat(50));
    logger.info(`Total applied: ${totalApplied}`);
    logger.info(`Total skipped (already applied): ${totalSkipped}`);
    logger.info(`Total failed: ${totalFailed}`);
    logger.info(`Total jobs in state: ${state.getAppliedCount()}`);
    logger.info('='.repeat(50));

  } catch (error) {
    logger.error('Fatal error', error as Error);
    if (page) {
      await takeScreenshot('fatal-error', true);
    }
    process.exit(1);
  } finally {
    await cleanup();
  }
}

// Run the automation
main().catch((error) => {
  logger.error('Unhandled error', error);
  process.exit(1);
});
