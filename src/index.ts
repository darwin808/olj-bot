import { loadConfig } from './config';
import { loadState } from './state';
import { initBrowser, cleanup, takeScreenshot } from './browser';
import { login } from './auth';
import { searchJobs } from './search';
import { applyToJob } from './apply';
import { logger } from './logger';

const MAX_JOBS_TO_FETCH = 20; // Fetch enough candidates without triggering rate limits

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

      // Search for more jobs than needed (to have candidates if some are already applied)
      const jobs = await searchJobs(
        page,
        searchTerm,
        MAX_JOBS_TO_FETCH,
        config.blockedEmployers,
        config.blockedSubjects,
        state
      );

      if (jobs.length === 0) {
        logger.warn(`No eligible jobs found for "${searchTerm}"`);
        continue;
      }

      // Track successful applications for this search term
      let appliedForTerm = 0;
      const targetForTerm = config.jobsPerSearchTerm;

      // Apply to jobs until we reach target or run out of candidates
      for (const job of jobs) {
        // Stop if we've reached target for this term
        if (appliedForTerm >= targetForTerm) {
          logger.info(`Reached target of ${targetForTerm} applications for "${searchTerm}"`);
          break;
        }

        // Double-check we haven't applied (in case state changed)
        if (state.hasApplied(job.id)) {
          logger.debug(`Skipping ${job.id} - already in local state`);
          continue;
        }

        const result = await applyToJob(page, job, config.proposal, config.blockedEmployers, config.dryRun);

        const employerName = result.employerName || job.employerName || 'Unknown';

        if (result.skipped) {
          // Blocked employer - skip without marking as applied
          logger.debug(`Skipped ${job.id} - blocked employer`);
          totalSkipped++;
        } else if (result.alreadyApplied) {
          // Mark as applied in our state so we don't try again
          state.markAsApplied({
            id: job.id,
            title: job.title,
            employerName,
            searchTerm: job.searchTerm,
            url: job.url
          });
          logger.info(`Already applied to ${job.title} - trying next job`);
          totalSkipped++;
          // Don't count towards target, try next job
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
          appliedForTerm++;
          logger.success(`Applied ${appliedForTerm}/${targetForTerm} for "${searchTerm}"`);
        } else {
          logger.error(`Failed to apply to ${job.title}: ${result.error || 'Unknown error'}`);
          totalFailed++;
          // Don't count towards target, try next job
        }

        // Rate limiting - random delay between 3-6 seconds to appear more human
        const delay = 3000 + Math.random() * 3000;
        await page.waitForTimeout(delay);
      }

      if (appliedForTerm < targetForTerm) {
        logger.warn(`Only applied to ${appliedForTerm}/${targetForTerm} jobs for "${searchTerm}" (ran out of candidates)`);
      }
    }

    // Summary
    logger.info('='.repeat(50));
    logger.info('SUMMARY');
    logger.info('='.repeat(50));
    logger.info(`Total applied: ${totalApplied}`);
    logger.info(`Total skipped (already applied/blocked): ${totalSkipped}`);
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
