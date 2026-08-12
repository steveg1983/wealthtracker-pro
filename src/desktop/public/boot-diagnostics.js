// Boot-error surface for the desktop shell. A white window is the worst
// failure mode there is: if the renderer dies before first paint, NOTHING
// says so. This file is a plain (non-module) script loaded before the entry,
// so it is registered before any module evaluates — an ES module entry runs
// all its imports first, which is exactly when early crashes happen, and a
// handler registered inside the entry would arrive too late. CSP allows it
// via script-src 'self'. It stands down the moment the app paints.
(function () {
  var painted = false;
  var failed = false;
  function show(kind, message, detail) {
    if (painted || failed) return;
    failed = true;
    var pre = document.createElement('pre');
    pre.style.cssText =
      'margin:2rem;padding:1.5rem;font:13px/1.5 ui-monospace,monospace;' +
      'white-space:pre-wrap;color:#7f1d1d;background:#fef2f2;' +
      'border:1px solid #fecaca;border-radius:12px;';
    pre.textContent =
      'WealthTracker could not start.\n\n' + kind + ': ' + message +
      (detail ? '\n\n' + detail : '') +
      '\n\nPlease screenshot this window.';
    document.body.replaceChildren(pre);
  }
  window.addEventListener('error', function (e) {
    show('Error', e.message || String(e.error),
      (e.filename || '') + (e.lineno ? ':' + e.lineno : ''));
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    show('Unhandled rejection', (r && (r.message || String(r))) || 'unknown',
      r && r.stack ? String(r.stack).slice(0, 800) : '');
  });
  // If nothing has painted after 6s and no error fired, say THAT too —
  // a hang is as silent as a crash.
  setTimeout(function () {
    var root = document.getElementById('root');
    if (!failed && (!root || root.childElementCount === 0)) {
      show('Timeout', 'nothing rendered within 6 seconds and no error was thrown',
        'The entry script may not have loaded at all.');
    }
  }, 6000);
  new MutationObserver(function () {
    var root = document.getElementById('root');
    if (root && root.childElementCount > 0) painted = true;
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
