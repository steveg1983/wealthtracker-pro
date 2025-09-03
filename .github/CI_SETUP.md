# CI Pipeline Setup Guide

## Required GitHub Secrets

To get all CI pipeline tests passing, you need to configure the following secrets in your GitHub repository settings:

### 1. Database & Authentication (Required for Tests)
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_key
```

### 2. Deployment (Vercel)
```
VERCEL_TOKEN=your_vercel_token
VERCEL_ORG_ID=your_vercel_org_id
VERCEL_PROJECT_ID=your_vercel_project_id
```

### 3. Error Tracking (Optional)
```
SENTRY_AUTH_TOKEN=your_sentry_auth_token
SENTRY_ORG=your_sentry_org
SENTRY_PROJECT=your_sentry_project
VITE_SENTRY_DSN=your_sentry_dsn
```

### 4. Security Scanning (Optional)
```
SNYK_TOKEN=your_snyk_token
```

### 5. Code Coverage (Optional)
```
CODECOV_TOKEN=your_codecov_token
```

### 6. Notifications (Optional)
```
SLACK_WEBHOOK_URL=your_slack_webhook_url
```

## Setting up Secrets in GitHub

1. Go to your repository on GitHub
2. Click on Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add each secret with its corresponding value

## Test Environment Setup

The tests expect a real Supabase instance with the following:
- Database with proper schema (see `supabase/migrations/`)
- Authentication configured
- Test user accounts

## E2E Test Configuration

E2E tests run against a built application. In CI, they:
1. Build the application
2. Serve it on localhost
3. Run Playwright tests against all browsers (Chromium, Firefox, WebKit)

## Known Issues

1. **Unit Tests**: Require real database connection (Supabase)
2. **E2E Tests**: Need proper environment variables and may fail without auth setup
3. **Security Scan**: npm audit may show vulnerabilities in dev dependencies

## Running Tests Locally

```bash
# Unit tests
npm run test:unit

# Integration tests  
npm run test:integration

# E2E tests
npx playwright test

# All tests
npm test
```

## Troubleshooting

### Tests fail with "PGRST100" error
- Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set correctly
- Check that your Supabase instance is running and accessible

### Clerk authentication errors
- Verify VITE_CLERK_PUBLISHABLE_KEY is set
- Ensure it starts with "pk_test_" for test environments

### E2E tests timeout
- Increase timeout in playwright.config.ts
- Check that dev server starts correctly with `npm run dev`

### Bundle size check fails
- Run `npm run build` locally to check bundle sizes
- Consider code splitting for large chunks
- The main vendor chunk (chunk-DSRSBF1e.js) is expected to be large due to dependencies