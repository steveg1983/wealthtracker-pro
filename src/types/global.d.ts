// Global type declarations

declare function gtag(...args: unknown[]): void;

// Network Information API (non-standard browser API)
// Note: effectiveType is string (not strict union) because browser API can return any value
interface NetworkInformation {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  addEventListener?: (type: string, listener: EventListener) => void;
  removeEventListener?: (type: string, listener: EventListener) => void;
}

// Extend Navigator with non-standard connection APIs
interface Navigator {
  connection?: NetworkInformation;
  mozConnection?: NetworkInformation;
  webkitConnection?: NetworkInformation;
  standalone?: boolean;  // iOS Safari PWA mode
  hapticFeedback?: {
    impactLight?: () => void;
    impactMedium?: () => void;
    impactHeavy?: () => void;
    notificationSuccess?: () => void;
    notificationWarning?: () => void;
    notificationError?: () => void;
    selectionChanged?: () => void;
    [key: string]: (() => void) | undefined;
  };
}

interface Window {
  Sentry?: {
    captureException: (error: Error) => void;
    captureMessage: (message: string) => void;
    withScope: (callback: (scope: unknown) => void) => void;
  };
  Clerk?: {
    user?: {
      id: string;
      emailAddresses?: Array<{ emailAddress: string }>;
    };
    session?: {
      getToken: () => Promise<string | null>;
    };
  };
  gtag?: typeof gtag;
  swRegistration?: ServiceWorkerRegistration | null;
  // Realtime sync action timestamp updater for echo prevention
  __updateRealtimeActionTimestamp?: (entity: string, actionType: string) => void;
}
