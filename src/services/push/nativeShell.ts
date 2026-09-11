/**
 * Is this page running inside the iOS shell?
 *
 * The shell (apps/mobile) is a Capacitor WebView around the cloud edition,
 * and Capacitor injects `window.Capacitor` into every page it loads before
 * the page's own scripts run. Its `isNativePlatform()` is the one question
 * that separates the shell from Safari, from a home-screen web app (which
 * matches `display-mode: standalone` — main.tsx's installed-app detector —
 * but has no native side), and from a desktop window.
 *
 * Push notifications exist only here: a web page has no APNs token to hand
 * over. Every push surface asks this first and draws nothing otherwise, so a
 * browser never shows a switch it cannot honour.
 */
export function isNativeShell(): boolean {
  if (typeof window === 'undefined') return false;
  const capacitor = window.Capacitor;
  return typeof capacitor?.isNativePlatform === 'function' && capacitor.isNativePlatform() === true;
}
