import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The iOS shell: a native window around the CLOUD edition.
 *
 * `server.url` points the WebView at the deployed app, so the phone always
 * runs what production runs — a deploy IS the mobile release, exactly the
 * property the owner's daily use depends on. The `www` directory this config
 * names exists only because Capacitor requires one; a single offline page
 * lives there for the no-network case.
 *
 * KNOWN AND ACCEPTED for the TestFlight phase: a remote-URL shell needs the
 * network, and App Store REVIEW (much later) will want bundled assets and
 * some native surface. TestFlight does not. Revisit when a public App Store
 * submission is actually in front of us — not before, because bundling the
 * assets means CORS work on the API and a second deploy pipeline, none of
 * which TestFlight requires.
 *
 * Sign-in on a phone requires the Clerk PRODUCTION instance (see
 * docs/clerk-production-runbook.md) — the dev instance's social login dies
 * on iOS Safari's tracking prevention. Until that lands, this shell is
 * proven against demo mode, which needs no sign-in.
 */
const config: CapacitorConfig = {
  appId: 'com.wealthtracker.mobile',
  appName: 'WealthTracker',
  webDir: 'www',
  server: {
    url: 'https://wealthtracker-web.vercel.app',
  },
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
