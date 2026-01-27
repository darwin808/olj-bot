import { Page } from 'playwright';
import { logger } from './logger';
import { SELECTORS, URLS } from './selectors';
import { takeScreenshot, waitAndRetry } from './browser';
import { isBlockedEmployer, isBlockedSubject } from './config';
import { StateManager } from './state';

export interface Job {
  id: string;
  title: string;
  employerName: string;
  url: string;
  searchTerm: string;
}

export async function searchJobs(
  page: Page,
  searchTerm: string,
  limit: number,
  blockedEmployers: string[],
  blockedSubjects: string[],
  state: StateManager
): Promise<Job[]> {
  logger.info(`Searching for: "${searchTerm}" (limit: ${limit})`);

  const jobs: Job[] = [];

  // Navigate directly to search results URL
  await waitAndRetry(async () => {
    await page.goto(URLS.SEARCH_WITH_TERM(searchTerm), { waitUntil: 'domcontentloaded' });
  });

  // Wait for page to load
  await page.waitForTimeout(3000);

  // Check for no results
  const noResults = await page.locator(SELECTORS.SEARCH.NO_RESULTS).isVisible().catch(() => false);
  if (noResults) {
    logger.warn(`No results found for "${searchTerm}"`);
    return [];
  }

  // Take screenshot of search results
  await takeScreenshot(`search-${searchTerm.replace(/\s+/g, '-')}`);

  // Extract jobs from the page
  const extractedJobs = await extractJobsFromPage(page, searchTerm);
  logger.debug(`Found ${extractedJobs.length} jobs on page`);

  // Filter jobs
  for (const job of extractedJobs) {
    if (jobs.length >= limit) break;

    // Skip if already applied
    if (state.hasApplied(job.id)) {
      logger.debug(`Skipping ${job.id} - already applied`);
      continue;
    }

    // Skip if blocked employer
    if (isBlockedEmployer(job.employerName, blockedEmployers)) {
      logger.debug(`Skipping ${job.id} - blocked employer: ${job.employerName}`);
      continue;
    }

    // Skip if blocked subject
    if (isBlockedSubject(job.title, blockedSubjects)) {
      logger.debug(`Skipping ${job.id} - blocked subject: ${job.title}`);
      continue;
    }

    jobs.push(job);
  }

  logger.info(`Found ${jobs.length} eligible jobs for "${searchTerm}"`);
  return jobs;
}

async function extractJobsFromPage(page: Page, searchTerm: string): Promise<Job[]> {
  const jobs: Job[] = [];

  try {
    // Wait for job links to appear
    await page.waitForSelector(SELECTORS.SEARCH.JOB_LINK, { timeout: 10000 }).catch(() => null);

    // Get all job links
    const jobLinks = await page.locator(SELECTORS.SEARCH.JOB_LINK).all();
    logger.debug(`Found ${jobLinks.length} job links on page`);

    const seenIds = new Set<string>();

    for (const linkElement of jobLinks) {
      try {
        const href = await linkElement.getAttribute('href').catch(() => null);
        if (!href) continue;

        // Extract job ID from URL - format: /jobseekers/job/Title-Slug-123456
        // ID is the last number at the end
        const idMatch = href.match(/-(\d+)$/);
        const jobId = idMatch ? idMatch[1] : null;

        if (!jobId || seenIds.has(jobId)) continue;
        seenIds.add(jobId);

        // Extract title from link text, or fallback to URL slug
        let title = await linkElement.textContent().catch(() => null);
        title = title?.trim() || null;

        // If title is empty, extract from URL slug
        if (!title) {
          // /jobseekers/job/Design-Engineer-Build-with-React-1561113 -> Design Engineer Build with React
          const slugMatch = href.match(/\/job\/(.+)-\d+$/);
          if (slugMatch) {
            title = slugMatch[1].replace(/-/g, ' ');
          }
        }

        const fullUrl = href.startsWith('http') ? href : `${URLS.BASE}${href}`;

        // Employer name will be fetched when we visit the job page
        // For now, use placeholder
        jobs.push({
          id: jobId,
          title: (title || 'Unknown Title').trim(),
          employerName: '', // Will be populated when visiting job page
          url: fullUrl,
          searchTerm
        });
      } catch (error) {
        logger.debug(`Failed to extract job data: ${(error as Error).message}`);
      }
    }
  } catch (error) {
    logger.error('Failed to extract jobs from page', error as Error);
    await takeScreenshot('extract-jobs-error', true);
  }

  return jobs;
}

// Extract employer name from job page
export async function getEmployerFromJobPage(page: Page): Promise<string> {
  try {
    const employerElement = page.locator(SELECTORS.JOB_PAGE.EMPLOYER).first();
    const visible = await employerElement.isVisible().catch(() => false);
    if (visible) {
      const name = await employerElement.textContent();
      return (name || 'Unknown').trim();
    }
  } catch {
    // Ignore
  }
  return 'Unknown';
}
