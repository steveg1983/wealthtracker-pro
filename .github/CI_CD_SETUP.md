# CI/CD Pipeline Setup Guide

## Overview
This guide provides instructions for setting up the CI/CD pipeline for WealthTracker. The pipeline includes automated testing, security scanning, performance monitoring, and deployment to staging and production environments.

## Required GitHub Secrets

### Critical Secrets (Required for Pipeline to Run)

#### 1. Supabase Configuration
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

#### 2. Clerk Authentication
```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your-key-here
```

#### 3. API Configuration
```bash
VITE_API_BASE_URL=http://localhost:3001
```

### Optional Secrets (Enhanced Features)

#### 4. Vercel Deployment (For Staging/Production)
```bash
VERCEL_TOKEN=your-vercel-token
VERCEL_ORG_ID=your-org-id
VERCEL_PROJECT_ID=your-project-id
```

#### 5. Error Tracking (Sentry)
```bash
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_AUTH_TOKEN=your-auth-token
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
```

#### 6. Security Scanning
```bash
SNYK_TOKEN=your-snyk-token
```

#### 7. Code Coverage
```bash
CODECOV_TOKEN=your-codecov-token
```

#### 8. Notifications
```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

#### 9. Financial Data APIs
```bash
VITE_ALPHA_VANTAGE_API_KEY=your-api-key
VITE_PLAID_PUBLIC_KEY=your-plaid-key (if using Plaid)
```

## Setting Up Secrets in GitHub

1. Go to your repository on GitHub
2. Click on **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret with its name and value

## Environment-Specific Configuration

### Development Environment
Create a `.env.local` file in your project root:
```bash
# Core Configuration
VITE_SUPABASE_URL=https://your-dev-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-dev-anon-key
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your-dev-key
VITE_API_BASE_URL=http://localhost:3001

# Optional Features
VITE_ENABLE_ERROR_TRACKING=false
VITE_APP_ENV=development
```

### Staging Environment
Configure in GitHub Secrets with `staging_` prefix:
```bash
staging_VITE_SUPABASE_URL=https://your-staging-project.supabase.co
staging_VITE_SUPABASE_ANON_KEY=your-staging-anon-key
staging_VITE_CLERK_PUBLISHABLE_KEY=pk_test_your-staging-key
staging_VITE_APP_ENV=staging
staging_VITE_ENABLE_ERROR_TRACKING=true
```

### Production Environment
Configure in GitHub Secrets:
```bash
VITE_SUPABASE_URL=https://your-prod-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-prod-anon-key
VITE_CLERK_PUBLISHABLE_KEY=pk_live_your-prod-key
VITE_APP_ENV=production
VITE_ENABLE_ERROR_TRACKING=true
```

## Pipeline Jobs Overview

### 1. Code Quality (`quality`)
- Runs ESLint for code linting
- TypeScript type checking
- Console.log detection in production code
- Bundle size verification

### 2. Unit & Integration Tests (`test-unit`)
- Runs unit tests with Vitest
- Runs integration tests
- Generates code coverage report
- Uploads to Codecov (if configured)

### 3. E2E Tests (`test-e2e`)
- Runs Playwright tests across multiple browsers
- Tests: Chromium, Firefox, WebKit
- Uploads test results and reports

### 4. Build (`build`)
- Builds the application with Vite
- Generates service worker manifest
- Creates build artifacts

### 5. Security Scan (`security`)
- Runs npm audit for dependency vulnerabilities
- Snyk security scanning (if configured)
- Uploads source maps to Sentry (if configured)

### 6. Performance Tests (`performance`)
- Runs Lighthouse CI for performance metrics
- Tests multiple pages
- Uploads performance reports

### 7. Deploy to Staging (`deploy-staging`)
- Triggers on `develop` branch
- Deploys to Vercel staging environment
- URL: https://staging.wealthtracker.app

### 8. Deploy to Production (`deploy-production`)
- Triggers on `main` branch
- Deploys to Vercel production environment
- URL: https://wealthtracker.app
- Creates GitHub releases for tags

### 9. Smoke Tests (`smoke-tests`)
- Runs after deployment
- Validates critical user flows
- Tests both staging and production

### 10. Notifications (`notify`)
- Sends Slack notifications (if configured)
- Reports pipeline status

## Testing the Pipeline Locally

### Run Individual Jobs Locally

```bash
# Code Quality
npm run lint
npx tsc --noEmit
./github/scripts/check-console-log.sh
npm run bundle:check

# Unit Tests
npm run test:unit

# Integration Tests  
npm run test:integration

# E2E Tests
npm run test:e2e

# Build
npm run build

# Security
npm audit --production
```

### Using Act for Local GitHub Actions Testing

Install [act](https://github.com/nektos/act) to run GitHub Actions locally:

```bash
# Install act
brew install act  # macOS
# or
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash  # Linux

# Run specific job
act -j quality
act -j test-unit
act -j build

# Run with secrets
act -j test-unit --secret-file .env.local
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Tests Failing Due to Missing Environment Variables
**Solution**: Ensure all required secrets are set in GitHub Settings

#### 2. Bundle Size Check Failing
**Solution**: Run `npm run bundle:check` locally to identify large bundles
- Consider code splitting
- Lazy load non-critical components
- Analyze with `npm run bundle:report`

#### 3. TypeScript Errors in CI
**Solution**: Run `npx tsc --noEmit` locally to catch type errors

#### 4. E2E Tests Timing Out
**Solution**: 
- Increase timeout in playwright.config.ts
- Check if test environment URLs are accessible
- Verify Playwright browsers are installed

#### 5. Deployment Failing
**Solution**:
- Verify Vercel tokens are correct
- Check build artifacts are generated
- Ensure environment variables are set for deployment

## Monitoring Pipeline Health

### Key Metrics to Track
- **Build Time**: Should be < 10 minutes
- **Test Coverage**: Maintain > 80% coverage
- **Bundle Size**: Keep main bundle < 1.5MB
- **Lighthouse Score**: Maintain > 90 for performance

### Pipeline Status Badge
Add to your README.md:
```markdown
[![CI Pipeline](https://github.com/yourusername/wealthtracker-web/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/wealthtracker-web/actions/workflows/ci.yml)
```

## Best Practices

1. **Never commit secrets** - Always use environment variables
2. **Test locally first** - Run tests before pushing
3. **Keep dependencies updated** - Regular npm audit
4. **Monitor bundle size** - Track with each build
5. **Maintain test coverage** - Don't merge PRs that reduce coverage
6. **Use branch protection** - Require CI to pass before merging

## Support

For issues with the CI/CD pipeline:
1. Check the [GitHub Actions logs](https://github.com/yourusername/wealthtracker-web/actions)
2. Review this documentation
3. Check for known issues in the repository
4. Contact the DevOps team if needed

---

*Last Updated: 2025-09-03*