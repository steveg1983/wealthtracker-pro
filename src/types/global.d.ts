// Global type declarations

interface Window {
  Sentry?: {
    captureException: (error: Error) => void;
    captureMessage: (message: string) => void;
    withScope: (callback: (scope: any) => void) => void;
  };
}