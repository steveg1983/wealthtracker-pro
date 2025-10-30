// Global type declarations

declare function gtag(...args: any[]): void;

interface Window {
  Sentry?: {
    captureException: (error: Error) => void;
    captureMessage: (message: string) => void;
    withScope: (callback: (scope: any) => void) => void;
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
}