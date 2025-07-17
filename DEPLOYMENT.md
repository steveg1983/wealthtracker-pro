# Deployment Guide

## Prerequisites

1. Vercel CLI is already installed as a dev dependency
2. You need to be logged in to Vercel

## First Time Setup

1. **Login to Vercel:**
   ```bash
   npm run vercel:login
   ```
   Choose your preferred login method (GitHub recommended)

2. **Link project to Vercel (if not already linked):**
   ```bash
   npm run vercel:link
   ```
   Follow the prompts to link to your existing Vercel project

3. **Pull environment variables (if any):**
   ```bash
   npm run vercel:env
   ```

## Deployment

### Deploy to Preview
```bash
npm run deploy
```

### Deploy to Production
```bash
npm run deploy:prod
```

## Manual Deployment Commands

### Using the deployment script:
```bash
./deploy.sh          # Deploy to preview
./deploy.sh prod     # Deploy to production
```

### Direct Vercel commands:
```bash
npx vercel           # Deploy to preview
npx vercel --prod    # Deploy to production
```

## Troubleshooting

1. **Not logged in error:**
   Run `npm run vercel:login`

2. **Project not linked:**
   Run `npm run vercel:link`

3. **Build errors:**
   - Check TypeScript errors: `npm run build:check`
   - Build without TypeScript check: `npm run build`

4. **GitHub integration issues:**
   - Check Vercel dashboard → Project Settings → Git
   - Ensure connected to correct repo and branch (main)
   - Try "Redeploy" button in Vercel dashboard

## Current Build Configuration

- TypeScript checking is temporarily disabled in production build
- Use `npm run build:check` to run full TypeScript validation
- Test files are excluded from build compilation