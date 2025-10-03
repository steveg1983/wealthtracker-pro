/**
 * Logging Service Interface
 * Defines the contract for logging operations
 */
export interface ILoggingService {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, error?: unknown): void;
  trackPerformance(operation: string, duration: number): void;
  trackActivity(category: string, action: string, value?: unknown): void;
}