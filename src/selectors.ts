// DOM Selectors for OnlineJobs.ph
// Updated based on actual site inspection

export const SELECTORS = {
  LOGIN: {
    // Login page: https://www.onlinejobs.ph/login
    EMAIL_INPUT: 'input#login_username',
    PASSWORD_INPUT: 'input#login_password',
    SUBMIT_BUTTON: 'button[type="submit"][name="login"]',
    // Element that appears after successful login
    LOGGED_IN_INDICATOR: 'a[href*="logout"], .user-menu, .dashboard'
  },

  SEARCH: {
    // Search page: https://www.onlinejobs.ph/jobseekers/jobsearch
    INPUT: 'input[name="jobkeyword"], input[data-cy="header-search"], input[data-cy="header-search-mobile"]',
    BUTTON: 'button[type="submit"], input[type="submit"]',
    // Each job listing in search results
    JOB_ITEM: 'div.jobpost-cat-box.latest-job-post, div.card-hover-default',
    JOB_LINK: 'a[href*="/jobseekers/job/"]',
    // Pagination
    NEXT_PAGE: '.pagination .next, a[rel="next"]',
    NO_RESULTS: '.no-results, .no-jobs-found, text="No jobs found"'
  },

  JOB_PAGE: {
    // Individual job page
    TITLE: 'h1',
    EMPLOYER: '.employer-name, .company-name',
    JOB_ID_INPUT: 'input[name="job_id"]',
    APPLY_BUTTON: 'button[type="submit"][value="Apply For This Job"]',
    ALREADY_APPLIED: 'text="already applied", text="Already Applied", .applied-badge, text="You have already applied"'
  },

  APPLICATION: {
    // Application form (appears after clicking Apply)
    SUBJECT_INPUT: 'input#subject, input[name="info[subject]"]',
    MESSAGE_TEXTAREA: 'textarea#message, textarea[name="info[message]"]',
    CONTACT_INFO_TEXTAREA: 'textarea#contact-info-content',
    SUBMIT_BUTTON: 'button[type="submit"][name="op"], button[value="Send Email"]',
    SUCCESS_MESSAGE: 'text="successfully", text="Application sent", .alert-success, text="Your application has been sent"'
  }
};

// URLs
export const URLS = {
  BASE: 'https://www.onlinejobs.ph',
  LOGIN: 'https://www.onlinejobs.ph/login',
  SEARCH: 'https://www.onlinejobs.ph/jobseekers/jobsearch',
  SEARCH_WITH_TERM: (term: string) => `https://www.onlinejobs.ph/jobseekers/jobsearch?jobkeyword=${encodeURIComponent(term)}`,
  JOB: (id: string) => `https://www.onlinejobs.ph/jobseekers/job/${id}`
};
