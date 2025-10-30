import * as Sentry from '@sentry/react';
import { lazyLogger } from '../services/serviceFactory';

const logger = lazyLogger.getLogger('Sentry');

const coerceEnvString = (value: string | boolean | undefined, fallback = ''): string =>
  typeof value === 'string' && value.length > 0 ? value : fallback;

const SENTRY_DSN = coerceEnvString(import.meta.env.VITE_SENTRY_DSN);
const APP_VERSION = coerceEnvString(import.meta.env.VITE_APP_VERSION, '1.0.0');
const APP_ENV = coerceEnvString(import.meta.env.VITE_APP_ENV, 'development');
const ENABLE_ERROR_TRACKING = coerceEnvString(import.meta.env.VITE_ENABLE_ERROR_TRACKING) === 'true';

type SanitizableData = Record<string, unknown>;

const isSanitizableData = (value: unknown): value is SanitizableData =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function initSentry() {
  if (!ENABLE_ERROR_TRACKING || !SENTRY_DSN) {
    logger.info('Sentry error tracking is disabled');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: APP_ENV,
    release: `wealthtracker@${APP_VERSION}`,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
        stickySession: true,
      }),
    ],
    tracesSampleRate: APP_ENV === 'production' ? 0.1 : 1.0,
    beforeSend: (event, hint) => {
      // Filter out sensitive data
      if (event.request?.data && isSanitizableData(event.request.data)) {
        const sanitizedData = { ...event.request.data };
        delete sanitizedData.password;
        delete sanitizedData.creditCard;
        delete sanitizedData.ssn;
        delete sanitizedData.bankAccount;
        event.request.data = sanitizedData;
      }
      
      // Don't send events in development unless explicitly enabled
      if (APP_ENV === 'development' && coerceEnvString(import.meta.env.VITE_SENTRY_SEND_IN_DEV) !== 'true') {
        logger.info('Sentry event captured (not sent in dev)', { event, hint });
        return null;
      }
      
      return event;
    },
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      // Random network errors
      'NetworkError',
      'Network request failed',
      // Safari specific
      'Non-Error promise rejection captured',
      // Chrome extensions
      /extensions\//i,
      /^chrome:\/\//i,
      /^moz-extension:\/\//i,
    ],
  });

  // Set initial user context
  const userId = localStorage.getItem('userId');
  if (userId) {
    Sentry.setUser({ id: userId });
  }
}

export function setSentryUser(user: { id: string; email?: string; username?: string }) {
  if (!ENABLE_ERROR_TRACKING) return;
  
  const sentryUser = {
    id: user.id,
    ...(user.email ? { email: user.email } : {}),
    ...(user.username ? { username: user.username } : {})
  };

  Sentry.setUser(sentryUser);
}

export function clearSentryUser() {
  if (!ENABLE_ERROR_TRACKING) return;
  
  Sentry.setUser(null);
}

export function captureException(error: Error, context?: Record<string, unknown>) {
  if (!ENABLE_ERROR_TRACKING) {
    logger.error('Error captured:', { error, context });
    return;
  }
  
  Sentry.captureException(error, {
    contexts: {
      custom: context,
    },
  });
}

export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, unknown>
) {
  if (!ENABLE_ERROR_TRACKING) {
    logger.info(message, { level, context });
    return;
  }
  
  Sentry.captureMessage(message, {
    level,
    contexts: {
      custom: context,
    },
  });
}

export function addBreadcrumb(breadcrumb: {
  message: string;
  category?: string;
  level?: Sentry.SeverityLevel;
  data?: Record<string, unknown>;
}) {
  if (!ENABLE_ERROR_TRACKING) return;
  
  Sentry.addBreadcrumb({
    ...breadcrumb,
    timestamp: Date.now() / 1000,
  });
}

export const SentryErrorBoundary = Sentry.ErrorBoundary;
