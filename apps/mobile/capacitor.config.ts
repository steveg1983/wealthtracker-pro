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
 * Points at the PRODUCTION domain, because that is where the Clerk
 * production instance lives — the runbook completed 26 Aug 2026, and Google
 * sign-in was verified on a real iPhone the same night. The vercel.app host
 * would sign nobody in: the pk_live instance answers only on the first-party
 * domain.
 */
const config: CapacitorConfig = {
  appId: 'com.wealthtracker.mobile',
  appName: 'WealthTracker',
  webDir: 'www',
  server: {
    url: 'https://www.wealthtrackerpro.co.uk',
  },
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
