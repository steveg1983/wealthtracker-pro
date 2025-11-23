// Global type declarations

declare function gtag(...args: unknown[]): void;

// Network Information API
interface NetworkInformation {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
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
}
