export const BACKGROUND_TELEMETRY_EVENT = 'background-telemetry';
export const SERVICE_WORKER_TELEMETRY_MESSAGE = 'wt-telemetry';

export type BackgroundTelemetryOrigin = 'service-worker' | 'mobile-service';

export interface BackgroundTelemetryPayload {
  origin: BackgroundTelemetryOrigin;
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: unknown;
  source: string;
  timestamp: number;
}
