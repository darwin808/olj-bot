import * as fs from 'fs';
import * as path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function getLogFilePath(): string {
  const date = new Date().toISOString().split('T')[0];
  return path.join(LOG_DIR, `automation-${date}.log`);
}

function formatMessage(level: string, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}`;
}

function writeToFile(message: string): void {
  ensureLogDir();
  fs.appendFileSync(getLogFilePath(), message + '\n');
}

export const logger = {
  info(message: string): void {
    const formatted = formatMessage('INFO', message);
    console.log(formatted);
    writeToFile(formatted);
  },

  error(message: string, error?: Error): void {
    const formatted = formatMessage('ERROR', message);
    console.error(formatted);
    writeToFile(formatted);
    if (error) {
      const errorMsg = `  ${error.message}`;
      console.error(errorMsg);
      writeToFile(errorMsg);
    }
  },

  warn(message: string): void {
    const formatted = formatMessage('WARN', message);
    console.warn(formatted);
    writeToFile(formatted);
  },

  success(message: string): void {
    const formatted = formatMessage('SUCCESS', message);
    console.log(formatted);
    writeToFile(formatted);
  },

  debug(message: string): void {
    const formatted = formatMessage('DEBUG', message);
    console.log(formatted);
    writeToFile(formatted);
  }
};
