import { configureStripeWebhookLogger } from '../lib/stripe-webhooks';
import {
  createConsoleBridgeLogger,
  createScopedLogger,
  type ConsoleBridgeLogger,
  type ScopedLogger,
} from './scopedLogger';

let sharedConsoleLogger: ConsoleBridgeLogger | null = null;
const scopedLoggerCache = new Map<string, ScopedLogger>();

const ensureConsoleLogger = (): ConsoleBridgeLogger => {
  if (!sharedConsoleLogger) {
    sharedConsoleLogger = createConsoleBridgeLogger('StripeClerkBridge');
    configureStripeWebhookLogger(sharedConsoleLogger);
  }
  return sharedConsoleLogger;
};

export const getStripeConsoleLogger = (): ConsoleBridgeLogger => ensureConsoleLogger();

export const getStripeScopedLogger = (scope: string): ScopedLogger => {
  const cached = scopedLoggerCache.get(scope);
  if (cached) {
    return cached;
  }

  ensureConsoleLogger();
  const scopedLogger = createScopedLogger(scope);
  scopedLoggerCache.set(scope, scopedLogger);
  return scopedLogger;
};
