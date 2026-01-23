import * as fs from 'fs';
import * as path from 'path';
import { config as dotenvConfig } from 'dotenv';
import { logger } from './logger';

dotenvConfig();

export interface Config {
  searchTerms: string[];
  blockedEmployers: string[];
  proposal: string;
  jobsPerSearchTerm: number;
  credentials: {
    email: string;
    password: string;
  };
  headless: boolean;
  dryRun: boolean;
}

export function loadConfig(): Config {
  const configPath = path.join(process.cwd(), 'config.json');

  if (!fs.existsSync(configPath)) {
    throw new Error('config.json not found');
  }

  const configJson = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  const email = process.env.ONLINEJOBS_EMAIL;
  const password = process.env.ONLINEJOBS_PASSWORD;

  if (!email || !password) {
    throw new Error('ONLINEJOBS_EMAIL and ONLINEJOBS_PASSWORD must be set in .env');
  }

  const config: Config = {
    searchTerms: configJson.searchTerms || [],
    blockedEmployers: (configJson.blockedEmployers || []).map((e: string) => e.toLowerCase()),
    proposal: configJson.proposal || '',
    jobsPerSearchTerm: configJson.jobsPerSearchTerm || 5,
    credentials: {
      email,
      password
    },
    headless: process.env.HEADLESS !== 'false',
    dryRun: process.env.DRY_RUN === 'true'
  };

  logger.info(`Config loaded: ${config.searchTerms.length} search terms, ${config.blockedEmployers.length} blocked employers`);
  logger.info(`Mode: ${config.dryRun ? 'DRY RUN' : 'LIVE'}, Headless: ${config.headless}`);

  return config;
}

export function isBlockedEmployer(employerName: string, blockedList: string[]): boolean {
  const normalizedName = employerName.toLowerCase().trim();
  return blockedList.some(blocked => normalizedName.includes(blocked));
}
