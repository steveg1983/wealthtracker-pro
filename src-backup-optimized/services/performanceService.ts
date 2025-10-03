import { lazyLogger as logger } from './serviceFactory';

export const performanceService = {
  measurePerformance: (operation: string, fn: () => void) => {
    const startTime = performance.now();
    fn();
    const duration = performance.now() - startTime;
    logger.debug(`Operation ${operation} took ${duration}ms`);
    return duration;
  },

  logMetric: (name: string, value: number) => {
    logger.debug(`Performance metric - ${name}: ${value}`);
  }
};