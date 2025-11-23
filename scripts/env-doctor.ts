import { loadEnv } from 'vite';
import { checkEnvironmentVariables } from '../src/utils/env-check';

const mode = process.env.NODE_ENV ?? 'development';
const loadedEnv = loadEnv(mode, process.cwd(), '');
Object.assign(process.env, loadedEnv);

const { values, issues } = checkEnvironmentVariables();

const headline = issues.length === 0
  ? '✅ Environment check passed – no blocking issues detected.'
  : `⚠️ Environment check surfaced ${issues.length} issue(s). See details below.`;

console.log('\n' + headline);

issues.forEach(issue => {
  const prefix = issue.level === 'error' ? 'ERROR ' : issue.level === 'warn' ? 'WARN  ' : 'INFO  ';
  console.log(`${prefix}: ${issue.message}`);
  if (issue.suggestion) {
    console.log(`        → ${issue.suggestion}`);
  }
});

if (issues.length === 0) {
  console.log('Everything required for Clerk, Stripe, Sentry, and Supabase is ready.');
}

console.log('\nLoaded keys:', Object.keys(values).join(', '));
console.log('\nEnvironment doctor complete.');
