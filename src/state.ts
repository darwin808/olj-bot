import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

export interface AppliedJob {
  id: string;
  title: string;
  employerName: string;
  searchTerm: string;
  appliedAt: string;
  url?: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'applied-jobs.json');

export class StateManager {
  private appliedJobs: Map<string, AppliedJob> = new Map();

  constructor() {
    this.load();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  load(): void {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
        const jobs: AppliedJob[] = Array.isArray(data) ? data : [];
        this.appliedJobs = new Map(jobs.map(job => [job.id, job]));
        logger.info(`Loaded ${this.appliedJobs.size} previously applied jobs`);
      } else {
        logger.info('No previous state file found, starting fresh');
      }
    } catch (error) {
      logger.error('Failed to load state file', error as Error);
      this.appliedJobs = new Map();
    }
  }

  save(): void {
    try {
      this.ensureDataDir();
      const jobs = Array.from(this.appliedJobs.values());
      fs.writeFileSync(STATE_FILE, JSON.stringify(jobs, null, 2));
      logger.debug(`Saved state with ${jobs.length} applied jobs`);
    } catch (error) {
      logger.error('Failed to save state file', error as Error);
    }
  }

  hasApplied(jobId: string): boolean {
    return this.appliedJobs.has(jobId);
  }

  markAsApplied(job: Omit<AppliedJob, 'appliedAt'>): void {
    const appliedJob: AppliedJob = {
      ...job,
      appliedAt: new Date().toISOString()
    };
    this.appliedJobs.set(job.id, appliedJob);
    this.save();
    logger.success(`Marked job ${job.id} (${job.title}) as applied`);
  }

  getAppliedCount(): number {
    return this.appliedJobs.size;
  }

  getAppliedJobs(): AppliedJob[] {
    return Array.from(this.appliedJobs.values());
  }
}

// Singleton instance
let stateManager: StateManager | null = null;

export function getStateManager(): StateManager {
  if (!stateManager) {
    stateManager = new StateManager();
  }
  return stateManager;
}

export function loadState(): StateManager {
  return getStateManager();
}
