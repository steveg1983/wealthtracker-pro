import * as Sentry from '@sentry/react';

type SentryLogger = Pick<Console, 'info' | 'error'>;

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';
const APP_ENV = import.meta.env.VITE_APP_ENV || 'development';
const ENABLE_ERROR_TRACKING = import.meta.env.VITE_ENABLE_ERROR_TRACKING === 'true';

type SentryContext = Record<string, unknown>;

let sentryLogger: SentryLogger = typeof console !== 'undefined'
  ? console
  : { info: () => {}, error: () => {} };

export function configureSentryLogger(logger: SentryLogger) {
  sentryLogger = logger;
}

// Keys whose values are redacted anywhere they appear in an event payload.
// Covers auth secrets, direct PII, and financial-data field names that show
// up in request bodies / breadcrumbs / component state captured by Sentry.
const PII_KEY_PATTERN =
  /pass|secret|token|auth|cookie|ssn|creditcard|card_?number|cvv|bank_?account|sort_?code|account_?number|email|phone|first_?name|last_?name|full_?name|address|dob|date_?of_?birth/i;

const REDACTED = '[redacted]';

const scrubValue = (value: unknown, depth = 0): unknown => {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = PII_KEY_PATTERN.test(k) ? REDACTED : scrubValue(v, depth + 1);
  }
  return out;
};

export const scrubEventPii = (event: Sentry.ErrorEvent): void => {
  if (event.request) {
    // Query strings can carry PII; drop them and scrub the body.
    if (event.request.query_string) event.request.query_string = REDACTED;
    if (event.request.data) event.request.data = scrubValue(event.request.data);
    if (event.request.cookies) delete event.request.cookies;
  }
  if (event.extra) event.extra = scrubValue(event.extra) as Record<string, unknown>;
  if (event.contexts) event.contexts = scrubValue(event.contexts) as typeof event.contexts;
  if (Array.isArray(event.breadcrumbs)) {
    for (const b of event.breadcrumbs) {
      if (b.data) b.data = scrubValue(b.data) as Record<string, unknown>;
    }
  }
};

export function initSentry() {
  if (!ENABLE_ERROR_TRACKING || !SENTRY_DSN) {
    sentryLogger.info('Sentry error tracking is disabled');
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
    beforeSend: (event, _hint) => {
      // Data minimization (GDPR Art 5(1)(c)): strip PII before anything leaves
      // the browser. The old fixed denylist missed nested data and query
      // strings; scrubEventPii recurses and redacts by key name.
      scrubEventPii(event);

      // Don't send events in development unless explicitly enabled
      if (APP_ENV === 'development' && !import.meta.env.VITE_SENTRY_SEND_IN_DEV) {
        sentryLogger.info('Sentry event captured (not sent in dev)');
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

  // Data minimization: send ONLY the opaque user id. The id is sufficient to
  // correlate errors to a user via our own DB; email/username are PII that
  // need not be replicated into a third-party processor. (Caller signature
  // keeps email/username so call sites need not change.)
  Sentry.setUser({ id: user.id });
}

export function clearSentryUser() {
  if (!ENABLE_ERROR_TRACKING) return;
  
  Sentry.setUser(null);
}

export function captureException(error: Error, context?: SentryContext) {
  if (!ENABLE_ERROR_TRACKING) {
    sentryLogger.error('Error captured while Sentry disabled', error);
    return;
  }
  
  Sentry.captureException(error, {
    contexts: {
      custom: context,
    },
  });
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: SentryContext) {
  if (!ENABLE_ERROR_TRACKING) {
    sentryLogger.info(`Sentry message suppressed: [${level}] ${message}`);
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
  data?: SentryContext;
}) {
  if (!ENABLE_ERROR_TRACKING) return;
  
  Sentry.addBreadcrumb({
    ...breadcrumb,
    timestamp: Date.now() / 1000,
  });
}

export const SentryErrorBoundary = Sentry.ErrorBoundary;
