import { useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { captureException } from '../lib/sentry';
import {
  BACKGROUND_TELEMETRY_EVENT,
  SERVICE_WORKER_TELEMETRY_MESSAGE,
  type BackgroundTelemetryPayload
} from '../constants/telemetry';

const notify = (detail: BackgroundTelemetryPayload) => {
  const message = detail.message || `${detail.origin} event`;
  const formattedMessage = detail.source ? `[${detail.source}] ${message}` : message;
  const context = {
    origin: detail.origin,
    source: detail.source,
    data: detail.data,
    timestamp: detail.timestamp
  };

  if (detail.level === 'error') {
    toast.error(formattedMessage, { position: 'bottom-right', duration: 4000 });
    captureException(new Error(`[${detail.origin}] ${message}`), {
      contexts: {
        telemetry: context,
      },
    });
    return;
  }

  if (detail.level === 'warn') {
    toast(formattedMessage, { position: 'bottom-right', duration: 3000 });
  }
};

export function useBackgroundTelemetry(): void {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleMobileTelemetry = (event: Event) => {
      const detail = (event as CustomEvent<BackgroundTelemetryPayload>).detail;
      if (!detail) return;
      notify(detail);
    };

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      const payload = event.data as
        | {
            type?: string;
            payload?: BackgroundTelemetryPayload;
          }
        | undefined;

      if (!payload || payload.type !== SERVICE_WORKER_TELEMETRY_MESSAGE || !payload.payload) {
        return;
      }

      notify(payload.payload);
    };

    window.addEventListener(BACKGROUND_TELEMETRY_EVENT, handleMobileTelemetry as EventListener);
    const serviceWorker = navigator.serviceWorker;
    serviceWorker?.addEventListener('message', handleServiceWorkerMessage as EventListener);

    return () => {
      window.removeEventListener(
        BACKGROUND_TELEMETRY_EVENT,
        handleMobileTelemetry as EventListener
      );
      serviceWorker?.removeEventListener(
        'message',
        handleServiceWorkerMessage as EventListener
      );
    };
  }, []);
}
