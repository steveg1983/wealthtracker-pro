import { createScopedLogger } from '../loggers/scopedLogger';

type IssueLevel = 'info' | 'warn' | 'error';

interface EnvIssue {
  key: string;
  level: IssueLevel;
  message: string;
  suggestion?: string;
}

interface EnvValues {
  VITE_CLERK_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_SERVICE_ROLE_KEY?: string;
  VITE_STRIPE_PUBLISHABLE_KEY?: string;
  VITE_SENTRY_DSN?: string;
  VITE_ENABLE_ERROR_TRACKING?: string;
  VITE_SENTRY_SEND_IN_DEV?: string;
  MODE?: string;
  NODE_ENV?: string;
}

interface EnvCheckResult {
  values: EnvValues;
  issues: EnvIssue[];
}

const logger = createScopedLogger('EnvCheck');

const readEnv = (key: string): string | undefined => {
  if (typeof import.meta !== 'undefined' && import.meta.env && key in import.meta.env) {
    return import.meta.env[key];
  }

  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }

  return undefined;
};

const maskValue = (value?: string): string | undefined => {
  if (!value) return value;
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}…`;
};

const addIssue = (issues: EnvIssue[], issue: EnvIssue, log = true) => {
  issues.push(issue);

  if (!log) {
    return;
  }

  const payload = { key: issue.key, suggestion: issue.suggestion };

  switch (issue.level) {
    case 'error':
      logger.error(issue.message, payload);
      break;
    case 'warn':
      logger.warn(issue.message, payload);
      break;
    default:
      logger.info(issue.message, payload);
      break;
  }
};

export function checkEnvironmentVariables(): EnvCheckResult {
  const values: EnvValues = {
    VITE_CLERK_PUBLISHABLE_KEY: readEnv('VITE_CLERK_PUBLISHABLE_KEY'),
    VITE_SUPABASE_URL: readEnv('VITE_SUPABASE_URL'),
    VITE_SUPABASE_ANON_KEY: readEnv('VITE_SUPABASE_ANON_KEY'),
    VITE_SUPABASE_SERVICE_ROLE_KEY: readEnv('VITE_SUPABASE_SERVICE_ROLE_KEY'),
    VITE_STRIPE_PUBLISHABLE_KEY: readEnv('VITE_STRIPE_PUBLISHABLE_KEY'),
    VITE_SENTRY_DSN: readEnv('VITE_SENTRY_DSN'),
    VITE_ENABLE_ERROR_TRACKING: readEnv('VITE_ENABLE_ERROR_TRACKING'),
    VITE_SENTRY_SEND_IN_DEV: readEnv('VITE_SENTRY_SEND_IN_DEV'),
    MODE: readEnv('MODE'),
    NODE_ENV: readEnv('NODE_ENV')
  };

  const issues: EnvIssue[] = [];

  logger.info('Running environment variable check', {
    mode: values.MODE ?? values.NODE_ENV ?? 'unknown'
  });

  if (!values.VITE_CLERK_PUBLISHABLE_KEY) {
    addIssue(issues, {
      key: 'VITE_CLERK_PUBLISHABLE_KEY',
      level: 'error',
      message: 'Clerk publishable key is missing – authentication cannot initialize.',
      suggestion: 'Set VITE_CLERK_PUBLISHABLE_KEY in .env.local (or the appropriate environment file).'
    });
  }

  if (!values.VITE_SUPABASE_URL || !values.VITE_SUPABASE_ANON_KEY) {
    addIssue(issues, {
      key: 'VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY',
      level: 'warn',
      message: 'Supabase URL or anon key is missing – realtime sync and imports will fall back to mocks.',
      suggestion: 'Populate both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable Supabase features.'
    });
  }

  if (!values.VITE_STRIPE_PUBLISHABLE_KEY) {
    addIssue(issues, {
      key: 'VITE_STRIPE_PUBLISHABLE_KEY',
      level: 'warn',
      message: 'Stripe publishable key is missing – subscription checkout will fail.',
      suggestion: 'Set VITE_STRIPE_PUBLISHABLE_KEY to a valid test key before exercising billing flows.'
    });
  }

  const trackingEnabled = values.VITE_ENABLE_ERROR_TRACKING === 'true';
  const dsnPresent = !!values.VITE_SENTRY_DSN;

  if (trackingEnabled && !dsnPresent) {
    addIssue(issues, {
      key: 'VITE_SENTRY_DSN',
      level: 'error',
      message: 'Error tracking is enabled but VITE_SENTRY_DSN is not configured.',
      suggestion: 'Provide a Sentry DSN or disable VITE_ENABLE_ERROR_TRACKING.'
    });
  }

  if (!trackingEnabled && dsnPresent) {
    addIssue(issues, {
      key: 'VITE_ENABLE_ERROR_TRACKING',
      level: 'info',
      message: 'Sentry DSN is set but VITE_ENABLE_ERROR_TRACKING is false; events will not be sent.',
      suggestion: 'Set VITE_ENABLE_ERROR_TRACKING=true to forward errors or remove the DSN.'
    });
  }

  const inDevelopment =
    (values.MODE ?? values.NODE_ENV ?? '').toLowerCase() !== 'production';

  if (inDevelopment && trackingEnabled && dsnPresent && values.VITE_SENTRY_SEND_IN_DEV !== 'true') {
    addIssue(issues, {
      key: 'VITE_SENTRY_SEND_IN_DEV',
      level: 'warn',
      message: 'Error tracking is enabled, but VITE_SENTRY_SEND_IN_DEV is not true – dev events will be dropped.',
      suggestion: 'Set VITE_SENTRY_SEND_IN_DEV=true when you need to verify Sentry locally.'
    });
  }

  if (!values.VITE_SUPABASE_SERVICE_ROLE_KEY) {
    addIssue(issues, {
      key: 'VITE_SUPABASE_SERVICE_ROLE_KEY',
      level: 'info',
      message: 'Supabase service role key not detected – Supabase smoke tests will skip privileged flows.',
      suggestion: 'Populate VITE_SUPABASE_SERVICE_ROLE_KEY if you plan to run npm run test:supabase-smoke.'
    });
  }

  if (issues.length === 0) {
    logger.info('Environment check completed with no blocking issues.');
  } else {
    logger.warn('Environment check completed with findings', { count: issues.length });
  }

  const sanitizedValues = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, maskValue(value)])
  ) as EnvValues;

  return {
    values: sanitizedValues,
    issues
  };
}
