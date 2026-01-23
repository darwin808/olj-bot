import { Page } from 'playwright';
import { logger } from './logger';
import { SELECTORS } from './selectors';
import { takeScreenshot, waitAndRetry } from './browser';
import { Job, getEmployerFromJobPage } from './search';
import { isBlockedEmployer } from './config';

export interface ApplicationResult {
  success: boolean;
  alreadyApplied: boolean;
  skipped: boolean;
  error?: string;
  employerName?: string;
}

export async function applyToJob(
  page: Page,
  job: Job,
  proposal: string,
  blockedEmployers: string[],
  dryRun: boolean = false
): Promise<ApplicationResult> {
  logger.info(`Applying to: ${job.title} (ID: ${job.id})`);

  try {
    // Navigate to job page
    await waitAndRetry(async () => {
      await page.goto(job.url, { waitUntil: 'domcontentloaded' });
    });

    await page.waitForTimeout(2000);

    // Log current URL for debugging
    const currentUrl = page.url();
    logger.debug(`On page: ${currentUrl}`);

    // Get employer name from job page
    const employerName = await getEmployerFromJobPage(page);
    logger.debug(`Employer: ${employerName}`);

    // Check if employer is blocked
    if (isBlockedEmployer(employerName, blockedEmployers)) {
      logger.warn(`Skipping ${job.id} - blocked employer: ${employerName}`);
      return { success: false, alreadyApplied: false, skipped: true, employerName };
    }

    // Check if already applied
    const alreadyApplied = await page.locator(SELECTORS.JOB_PAGE.ALREADY_APPLIED).first().isVisible().catch(() => false);
    if (alreadyApplied) {
      logger.warn(`Already applied to: ${job.title}`);
      return { success: false, alreadyApplied: true, skipped: false, employerName };
    }

    // Find apply button - try multiple approaches
    let applyButton = page.locator(SELECTORS.JOB_PAGE.APPLY_BUTTON).first();
    let applyButtonVisible = await applyButton.isVisible().catch(() => false);

    // Fallback: try finding any button with "Apply" text
    if (!applyButtonVisible) {
      applyButton = page.locator('button:has-text("Apply"), a.btn:has-text("Apply")').first();
      applyButtonVisible = await applyButton.isVisible().catch(() => false);
    }

    // Log what buttons we can see for debugging
    if (!applyButtonVisible) {
      const allButtons = await page.locator('button').allTextContents().catch(() => []);
      logger.debug(`Buttons on page: ${allButtons.slice(0, 5).join(', ')}`);
      logger.warn(`Apply button not found for: ${job.title}`);
      await takeScreenshot(`no-apply-button-${job.id}`, true);
      return { success: false, alreadyApplied: false, skipped: false, error: 'Apply button not found', employerName };
    }

    if (dryRun) {
      logger.info(`[DRY RUN] Would apply to: ${job.title}`);
      return { success: true, alreadyApplied: false, skipped: false, employerName };
    }

    // Click apply button
    await applyButton.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Fill application form
    // Subject field - use h1 from job page
    const subjectField = page.locator(SELECTORS.APPLICATION.SUBJECT_INPUT).first();
    const subjectVisible = await subjectField.isVisible().catch(() => false);
    if (subjectVisible) {
      // Get the job title from h1 on the page
      const h1Element = page.locator('h1').first();
      const h1Text = await h1Element.textContent().catch(() => null);
      const subject = h1Text ? h1Text.trim() : job.title;
      await subjectField.fill(subject);
      logger.debug(`Subject filled: ${subject}`);
    }

    // Message field (main proposal)
    const messageField = page.locator(SELECTORS.APPLICATION.MESSAGE_TEXTAREA).first();
    const messageVisible = await messageField.isVisible().catch(() => false);

    if (messageVisible) {
      await messageField.fill(proposal);
      logger.debug('Message filled');
    } else {
      // Try any textarea as fallback
      const anyTextarea = page.locator('textarea').first();
      const textareaVisible = await anyTextarea.isVisible().catch(() => false);
      if (textareaVisible) {
        await anyTextarea.fill(proposal);
        logger.debug('Filled fallback textarea');
      } else {
        logger.warn(`Could not find message field for: ${job.title}`);
        await takeScreenshot(`no-message-field-${job.id}`, true);
        return { success: false, alreadyApplied: false, skipped: false, error: 'Message field not found', employerName };
      }
    }

    // Submit application
    const submitButton = page.locator(SELECTORS.APPLICATION.SUBMIT_BUTTON).first();
    const submitVisible = await submitButton.isVisible().catch(() => false);

    if (!submitVisible) {
      // Try generic submit button
      const genericSubmit = page.locator('button[type="submit"]').first();
      await genericSubmit.click();
    } else {
      await submitButton.click();
    }

    // Wait for submission
    await page.waitForTimeout(3000);

    // Check for success
    const successVisible = await page.locator(SELECTORS.APPLICATION.SUCCESS_MESSAGE).first().isVisible().catch(() => false);

    if (successVisible) {
      logger.success(`Successfully applied to: ${job.title}`);
      await takeScreenshot(`applied-${job.id}`);
      return { success: true, alreadyApplied: false, skipped: false, employerName };
    }

    // Check URL change (might indicate success)
    const finalUrl = page.url();
    if (!finalUrl.includes(job.id)) {
      logger.success(`Application likely successful for: ${job.title} (redirected)`);
      return { success: true, alreadyApplied: false, skipped: false, employerName };
    }

    // Check for any alert/success elements
    const anySuccess = await page.locator('.alert-success, .success, [class*="success"]').first().isVisible().catch(() => false);
    if (anySuccess) {
      logger.success(`Application successful for: ${job.title}`);
      return { success: true, alreadyApplied: false, skipped: false, employerName };
    }

    logger.warn(`Application status unclear for: ${job.title}`);
    await takeScreenshot(`unclear-status-${job.id}`, true);
    // Assume success if no error visible
    return { success: true, alreadyApplied: false, skipped: false, employerName };

  } catch (error) {
    logger.error(`Failed to apply to ${job.title}`, error as Error);
    await takeScreenshot(`apply-error-${job.id}`, true);
    return { success: false, alreadyApplied: false, skipped: false, error: (error as Error).message };
  }
}
