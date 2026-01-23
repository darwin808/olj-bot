import { Page } from 'playwright';
import { logger } from './logger';
import { SELECTORS, URLS } from './selectors';
import { takeScreenshot, waitAndRetry } from './browser';

export async function login(page: Page, email: string, password: string): Promise<void> {
  logger.info('Starting login process');

  await waitAndRetry(async () => {
    await page.goto(URLS.LOGIN, { waitUntil: 'domcontentloaded' });
  });

  // Wait for email input to be visible
  await page.waitForSelector(SELECTORS.LOGIN.EMAIL_INPUT, { state: 'visible', timeout: 15000 });
  logger.debug('Navigated to login page');

  // Fill in credentials
  await page.fill(SELECTORS.LOGIN.EMAIL_INPUT, email);
  await page.fill(SELECTORS.LOGIN.PASSWORD_INPUT, password);

  logger.debug('Credentials entered');

  // Click submit
  await page.click(SELECTORS.LOGIN.SUBMIT_BUTTON);

  // Wait for navigation after login
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  // Verify login was successful
  const isLoggedIn = await verifyLogin(page);

  if (!isLoggedIn) {
    await takeScreenshot('login-failed', true);
    throw new Error('Login failed - could not verify successful login');
  }

  logger.success('Login successful');
}

async function verifyLogin(page: Page): Promise<boolean> {
  try {
    // Check if we're redirected away from login page
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      // Still on login page, might have failed
      // Check for error messages
      const errorVisible = await page.locator('.error, .alert-danger, [class*="error"]').isVisible().catch(() => false);
      if (errorVisible) {
        const errorText = await page.locator('.error, .alert-danger, [class*="error"]').textContent().catch(() => '');
        logger.error(`Login error: ${errorText}`);
        return false;
      }
    }

    // Wait a bit for any dashboard/home redirect
    await page.waitForTimeout(2000);

    // Check for logged-in indicators
    const loggedInIndicator = await page.locator(SELECTORS.LOGIN.LOGGED_IN_INDICATOR).first().isVisible().catch(() => false);

    if (loggedInIndicator) {
      return true;
    }

    // Alternative check: look for logout link
    const logoutLink = await page.locator('a[href*="logout"], button:has-text("Logout"), a:has-text("Logout")').first().isVisible().catch(() => false);

    if (logoutLink) {
      return true;
    }

    // Check URL changed from login
    const newUrl = page.url();
    if (!newUrl.includes('/login')) {
      // Navigated away from login, probably successful
      return true;
    }

    return false;
  } catch (error) {
    logger.error('Error verifying login', error as Error);
    return false;
  }
}

export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    const logoutLink = await page.locator('a[href*="logout"], button:has-text("Logout")').first().isVisible().catch(() => false);
    return logoutLink;
  } catch {
    return false;
  }
}
