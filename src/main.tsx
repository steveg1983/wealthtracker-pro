// FIRST import: configures zod before any module-scope schema is built.
// See the file for why (it removes a per-load CSP violation).
import './lib/zodConfig'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import type { Appearance } from '@clerk/types'
import { ClerkErrorBoundary } from './components/auth/ClerkErrorBoundary'
import './styles/borders.css'
import './styles/accessibility-colors.css'
import './index.css'
import App from './App.tsx'
import * as serviceWorkerRegistration from './utils/serviceWorkerRegistration'
import { initializeSecurity } from './security'
import { pushNotificationService } from './services/pushNotificationService'
import { checkEnvironmentVariables } from './utils/env-check'
import { captureMessage, initSentry } from './lib/sentry'
import { createScopedLogger } from './loggers/scopedLogger'
import {
  persistRuntimeControlSanitizationSignal,
  sanitizeRuntimeControlSearchWithDetails,
  sanitizeRuntimeControlStorageWithDetails
} from './utils/runtimeMode'

const bootstrapLogger = createScopedLogger('AppBootstrap');

// DEV-ONLY boot profiler: `sessionStorage.bootProfile = '1'` then reload —
// the whole boot is sampled (JS Self-Profiling API, enabled by the dev
// server's Document-Policy header) and the trace parked on
// `window.__bootTrace` for inspection. No-op in production builds.
if (import.meta.env.DEV && sessionStorage.getItem('bootProfile') === '1') {
  try {
    type ProfilerTrace = { samples: unknown[]; stacks: unknown[]; frames: unknown[] };
    type ProfilerLike = { stop(): Promise<ProfilerTrace> };
    type ProfilerCtor = new (opts: { sampleInterval: number; maxBufferSize: number }) => ProfilerLike;
    const ProfilerClass = (globalThis as { Profiler?: ProfilerCtor }).Profiler;
    if (ProfilerClass) {
      const profiler = new ProfilerClass({ sampleInterval: 5, maxBufferSize: 1_000_000 });
      setTimeout(() => {
        void profiler.stop().then(trace => {
          (window as unknown as { __bootTrace?: ProfilerTrace }).__bootTrace = trace;
          bootstrapLogger.info('Boot profile captured on window.__bootTrace');
        });
      }, 20_000);
    }
  } catch {
    // Profiling is best-effort tooling; never let it affect boot.
  }
}

// Reduced motion is handled entirely in CSS, by the
// `@media (prefers-reduced-motion: reduce)` block in index.css that flattens
// every animation and transition. The `.reduce-motion` class this used to put
// on <html> matched no selector anywhere, so it changed nothing.
const disableServiceWorker = import.meta.env.VITE_DISABLE_SERVICE_WORKER === 'true';
let runtimeControlSanitizationContext: {
  removedQueryParams: ('demo' | 'testMode')[];
  removedStorageKeys: ('isTestMode' | 'demoMode')[];
  path: string;
} | null = null;

if (typeof window !== 'undefined') {
  const searchSanitization = sanitizeRuntimeControlSearchWithDetails(window.location.search, import.meta.env);
  if (searchSanitization.sanitizedSearch !== window.location.search) {
    const sanitizedUrl = `${window.location.pathname}${searchSanitization.sanitizedSearch}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', sanitizedUrl);
  }
  const storageSanitization = sanitizeRuntimeControlStorageWithDetails(import.meta.env, window.localStorage);

  if (searchSanitization.removedParams.length > 0 || storageSanitization.removedKeys.length > 0) {
    runtimeControlSanitizationContext = {
      removedQueryParams: searchSanitization.removedParams,
      removedStorageKeys: storageSanitization.removedKeys,
      path: window.location.pathname
    };

    persistRuntimeControlSanitizationSignal(
      runtimeControlSanitizationContext,
      window.sessionStorage
    );
  }
}

// Check environment variables in development
if (import.meta.env.DEV) {
  checkEnvironmentVariables();
}

// Get Clerk publishable key
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) {
  bootstrapLogger.error('Missing VITE_CLERK_PUBLISHABLE_KEY in environment variables');
  bootstrapLogger.info('Available env vars', { keys: Object.keys(import.meta.env) });
}

// Initialize all security features
initializeSecurity();

// Clean up old service workers (for migration)
if (!disableServiceWorker && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const registration of registrations) {
      // Only unregister if it's not our current service worker
      if (!registration.active?.scriptURL.includes('sw.js')) {
        registration.unregister();
        bootstrapLogger.info('Unregistered legacy service worker', { scope: registration.scope });
      }
    }
  });
}

// Initialize Sentry error tracking
try {
  initSentry();
} catch (error) {
  bootstrapLogger.error('Error initializing Sentry', error);
}

if (runtimeControlSanitizationContext) {
  bootstrapLogger.warn('Sanitized runtime control inputs at bootstrap', runtimeControlSanitizationContext);
  captureMessage(
    'Sanitized runtime control inputs at bootstrap',
    'warning',
    runtimeControlSanitizationContext
  );
}

// Add error logging
window.addEventListener('error', (event): void => {
  // Filter benign errors
  if (event.message?.includes('ResizeObserver')) {
    event.preventDefault();
    return;
  }

  // bootstrapLogger.error() already suppresses console in production via LoggingService
  // (src/services/loggingService.ts line 151: if (this.outputToConsole))
  bootstrapLogger.error('Global error captured', event.error);

  // Prevent browser's default console logging in production
  if (!import.meta.env.DEV) {
    event.preventDefault();
  }
});

window.addEventListener('unhandledrejection', (event): void => {
  bootstrapLogger.error('Unhandled promise rejection', event.reason);

  // Prevent browser's default console logging in production
  if (!import.meta.env.DEV) {
    event.preventDefault();
  }
});

// Clerk's sign-in / sign-up modals and the UserButton menu render on top of the
// app but in a portal outside its Tailwind scope, so they don't inherit the
// app's palette on their own — left alone they wear Clerk's default bright blue.
// This appearance derives every Clerk surface from the app's own slate
// (#1a2332, with the lighter #2d3a4d for hover) so the modal that opens from the
// landing page reads as the same product, not a bolted-on third party.
//
// No dark-mode variant on purpose: the `baseTheme: dark` swap needs the
// @clerk/themes package, which is NOT a dependency here and which we don't add.
// Clerk modals float on their own backdrop, so a light modal over a dark app is
// legible and is Clerk's own common default — acceptable until a theme package
// is ever introduced.
//
// The "Development mode" strip at the modal's foot is Clerk's *development
// instance* badge. It cannot be removed by styling — it disappears on its own
// once the app runs on Clerk production keys. Don't chase it here.
const clerkAppearance: Appearance = {
  variables: {
    // Everything (buttons, links, focus rings) derives from the app slate.
    colorPrimary: '#1a2332',
    // White label on #1a2332 is ~15:1 contrast — passes WCAG AA/AAA.
    colorPrimaryForeground: '#ffffff',
    // `colorText` is deprecated in this Clerk version; `colorForeground` is its
    // replacement. Near-black body/heading text, matching the app's gray-900.
    colorForeground: '#111827',
    // Muted subtitle grey, matching the app's gray-500.
    colorMutedForeground: '#6b7280',
    // Inherit the app's Inter stack (set on <body> in index.html); the modal
    // renders in a portal on document.body so 'inherit' reaches it.
    fontFamily: 'inherit',
    fontFamilyButtons: 'inherit',
    // rounded-xl (0.75rem), matching the app's own buttons.
    borderRadius: '0.75rem'
  },
  elements: {
    // Slate primary button whose hover goes *lighter* (#2d3a4d). Clerk would
    // otherwise darken an already-dark primary toward black; the app's own
    // hover token is the lighter secondary slate, so we mirror it.
    formButtonPrimary: {
      backgroundColor: '#1a2332',
      color: '#ffffff',
      '&:hover': { backgroundColor: '#2d3a4d' },
      '&:focus': { backgroundColor: '#2d3a4d' },
      '&:active': { backgroundColor: '#1a2332' }
    },
    // Match the app's rounded-2xl card surfaces (~1rem).
    card: { borderRadius: '1rem' },
    headerTitle: { color: '#111827' },
    headerSubtitle: { color: '#6b7280' },
    // Social / secondary buttons stay neutral (near-black label, never blue).
    socialButtonsBlockButton: { color: '#111827' },
    /*
     * THE AVATAR, which is the most-seen element in the product and was the
     * only gradient in it.
     *
     * The design review flagged a purple→blue gradient "top-right of every page
     * in the app" and reasonably assumed it was ours. It is not — it is Clerk's
     * generated initials avatar, which is why searching our source for
     * `from-purple-500 to-blue-600` finds nothing. But the conclusion that we
     * could not change it was also wrong: this appearance object reaches every
     * Clerk surface, and it simply had no rule for the avatar.
     *
     * `backgroundImage: 'none'` first, because the default is a background
     * IMAGE — a colour alone would paint underneath it and change nothing.
     * Slate with a white initial, matching the ruling and every other Clerk
     * surface above.
     */
    avatarBox: {
      backgroundImage: 'none',
      backgroundColor: '#1a2332',
      color: '#ffffff'
    }
  }
};

// Remove any pre-existing dark class on app start
document.documentElement.classList.remove('dark');

try {
  const root = document.getElementById('root');
  if (!root) {
    bootstrapLogger.error('Root element not found');
  } else {
    bootstrapLogger.info('Starting React app');
    createRoot(root).render(
      <StrictMode>
        <ClerkErrorBoundary>
          <ClerkProvider
            publishableKey={PUBLISHABLE_KEY}
            afterSignOutUrl="/"
            appearance={clerkAppearance}
            allowedRedirectOrigins={[window.location.origin]}
            // Clerk's usage telemetry posts to clerk-telemetry.com, which the
            // CSP's connect-src deliberately does not list — so every page load
            // logged a CSP violation for a request we do not need. Widening the
            // policy to admit an analytics host would be the wrong trade: a
            // console full of expected errors is where a real one goes unseen.
            telemetry={{ disabled: true }}
          >
            <App />
          </ClerkProvider>
        </ClerkErrorBoundary>
      </StrictMode>,
    );
    bootstrapLogger.info('React app rendered');
  }
} catch (error) {
  bootstrapLogger.error('Error rendering app', error);
}

// Register service worker for offline support
let _swRegistration: ServiceWorkerRegistration | null = null;

if (disableServiceWorker) {
  bootstrapLogger.info('Service worker registration disabled by VITE_DISABLE_SERVICE_WORKER');
} else {
  serviceWorkerRegistration.register({
    onSuccess: async (registration) => {
      _swRegistration = registration;
      bootstrapLogger.info('Service Worker registered successfully');

      // Store registration globally for React components to access
      window.swRegistration = registration;

      // Initialize push notifications
      try {
        await pushNotificationService.initialize();
        bootstrapLogger.info('Push notifications initialized');
      } catch (error) {
        bootstrapLogger.error('Failed to initialize push notifications', error);
      }
    },
    onUpdate: (registration) => {
      _swRegistration = registration;
      bootstrapLogger.info('New app version available');

      // Store registration globally for React components to access
      window.swRegistration = registration;

      // The ServiceWorkerUpdateNotification component will handle the UI
      // Dispatch a custom event that React components can listen to
      window.dispatchEvent(new CustomEvent('sw-update-available', {
        detail: { registration }
      }));
    },
    onOffline: () => {
      // Dispatch offline event for React components
      window.dispatchEvent(new Event('app-offline'));
    },
    onOnline: () => {
      // Dispatch online event for React components
      window.dispatchEvent(new Event('app-online'));
    }
  });
}
