import { chromium, Browser, Page, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;

const SCREENSHOTS_DIR = path.join(process.cwd(), 'screenshots');
const ERRORS_DIR = path.join(SCREENSHOTS_DIR, 'errors');

function ensureScreenshotDirs(): void {
  if (!fs.existsSync(ERRORS_DIR)) {
    fs.mkdirSync(ERRORS_DIR, { recursive: true });
  }
}

export async function initBrowser(headless: boolean = true): Promise<Page> {
  logger.info(`Initializing browser (headless: ${headless})`);

  browser = await chromium.launch({
    headless,
    slowMo: headless ? 0 : 100 // Slow down when not headless for visibility
  });

  context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  page = await context.newPage();

  // Set default timeout
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(30000);

  logger.info('Browser initialized');
  return page;
}

export async function getPage(): Promise<Page> {
  if (!page) {
    throw new Error('Browser not initialized. Call initBrowser() first.');
  }
  return page;
}

export async function takeScreenshot(name: string, isError: boolean = false): Promise<string | null> {
  if (!page) {
    logger.warn('Cannot take screenshot: no page available');
    return null;
  }

  try {
    ensureScreenshotDirs();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = isError ? ERRORS_DIR : SCREENSHOTS_DIR;
    const filename = `${name}-${timestamp}.png`;
    const filepath = path.join(dir, filename);

    await page.screenshot({ path: filepath, fullPage: true });
    logger.debug(`Screenshot saved: ${filepath}`);
    return filepath;
  } catch (error) {
    logger.error('Failed to take screenshot', error as Error);
    return null;
  }
}

export async function cleanup(): Promise<void> {
  logger.info('Cleaning up browser');

  if (page) {
    await page.close().catch(() => {});
    page = null;
  }

  if (context) {
    await context.close().catch(() => {});
    context = null;
  }

  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
  }

  logger.info('Browser cleanup complete');
}

export async function waitAndRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delayMs: number = 2000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      logger.warn(`Attempt ${i + 1}/${retries} failed: ${lastError.message}`);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}
