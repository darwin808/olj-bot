# OnlineJobs.ph Job Application Automation

Auto-apply to jobs on OnlineJobs.ph. Searches specified terms and applies to top jobs that haven't been applied to yet.

## Setup

```bash
npm install
npx playwright install chromium
```

## Configuration

### config.json
- `searchTerms`: Array of job search terms
- `blockedEmployers`: Employers to skip (case-insensitive partial match)
- `proposal`: Cover letter text for applications
- `jobsPerSearchTerm`: Max jobs to apply per search term

### .env
- `ONLINEJOBS_EMAIL`: Your OnlineJobs.ph email
- `ONLINEJOBS_PASSWORD`: Your password
- `HEADLESS`: `true` or `false` (run browser visibly)
- `DRY_RUN`: `true` or `false` (skip actual applications)

## Usage

### First run (watch it work)
```bash
HEADLESS=false npm run dev
```

### Dry run (no real applications)
```bash
DRY_RUN=true npm run dev
```

### Production
```bash
npm run dev
```

## Important: Update Selectors

Before running, you MUST update `src/selectors.ts` with actual DOM selectors from OnlineJobs.ph:

1. Login to OnlineJobs.ph manually
2. Open DevTools (F12)
3. Inspect each element (login form, search, job listings, apply button)
4. Copy the correct CSS selectors
5. Update `src/selectors.ts`

## Output

- **Logs**: `logs/automation-{date}.log`
- **Screenshots**: `screenshots/` and `screenshots/errors/`
- **State**: `data/applied-jobs.json` (tracks applied jobs)
