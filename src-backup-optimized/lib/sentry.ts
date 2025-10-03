import * as Sentry from '@sentry/react';
import { useLogger } from '../services/ServiceProvider';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';
const APP_ENV = import.meta.env.VITE_APP_ENV || 'development';
const ENABLE_ERROR_TRACKING = import.meta.env.VITE_ENABLE_ERROR_TRACKING === 'true';

export function initSentry() {
  const logger = useLogger();
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
      if (event.request?.data && typeof event.request.data === 'object') {
        const data = event.request.data as any;
        // Remove sensitive fields
        delete data.password;
        delete data.creditCard;
        delete data.ssn;
        delete data.bankAccount;
      }
      
      // Don't send events in development unless explicitly enabled
      if (APP_ENV === 'development' && !import.meta.env.VITE_SENTRY_SEND_IN_DEV) {
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
  
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
  });
}

export function clearSentryUser() {
  if (!ENABLE_ERROR_TRACKING) return;
  
  Sentry.setUser(null);
}

export function captureException(error: Error, context?: Record<string, any>) {
  if (!ENABLE_ERROR_TRACKING) {
    logger.error('Error captured:', error, context ? JSON.stringify(context) : undefined);
    return;
  }
  
  Sentry.captureException(error, {
    contexts: {
      custom: context,
    },
  });
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>) {
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
  data?: Record<string, any>;
}) {
  if (!ENABLE_ERROR_TRACKING) return;
  
  Sentry.addBreadcrumb({
    ...breadcrumb,
    timestamp: Date.now() / 1000,
  });
}

// Removed SentryErrorBoundary export due to React.Component bundling issue
// Use the regular ErrorBoundary component instead
