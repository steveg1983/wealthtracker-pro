/**
 * The shell's renderer.
 *
 * ── WHAT IS HERE, AND WHAT IS DELIBERATELY NOT ──────────────────────────────
 *
 * This file does two things and nothing else: it finds `invoke`, and it draws
 * the one screen that exists before a ledger is open. Everything with a decision
 * in it — the transport, the port, the backup format, the .mny planner, the boot
 * order — is in `src/services/local/deviceDocument.ts`, because `apps/**` is
 * outside this repo's lint, typecheck and test roots and a wiring decision that
 * nothing checks is a wiring decision that drifts.
 *
 * THE APPLICATION IS NOT MOUNTED HERE YET. The React app takes a `DataPort`
 * through its provider and this hands it one, but connecting the two is a slice
 * of its own: it means a build of the app that is not the web build, a router
 * with no cloud routes in it, and a sign-in screen that is a file chooser. What
 * this screen proves is that the whole path works end to end — chooser, locks,
 * schema, owner, seed, boot — and it says so rather than pretending to be more.
 *
 * ── WHERE `invoke` COMES FROM ───────────────────────────────────────────────
 *
 * `window.__TAURI__`, put there by `withGlobalTauri` in `tauri.conf.json`, and
 * NOT from `@tauri-apps/api`. Installing that package would mean Vercel's build
 * container fetching a desktop dependency on every deploy of the web app — the
 * objection `crates/Cargo.toml` makes about Rust, one ecosystem along. The
 * global is read through a guard rather than a cast, because a renderer that
 * assumed it was there would fail with `undefined is not a function` in a window
 * with no console open.
 */

import {
  bootDeviceLedger,
  openDeviceDocument,
  type OpenLedger
} from '../../../src/services/local/deviceDocument';
import type { Invoke } from '../../../src/services/local/coreTransport';

/** The shape `withGlobalTauri` puts on the window. */
interface TauriGlobal {
  core: { invoke: Invoke };
}

const tauriGlobal = (): TauriGlobal | null => {
  const candidate = (window as unknown as { __TAURI__?: unknown }).__TAURI__;
  if (typeof candidate !== 'object' || candidate === null) return null;
  const core = (candidate as { core?: unknown }).core;
  if (typeof core !== 'object' || core === null) return null;
  const invoke = (core as { invoke?: unknown }).invoke;
  return typeof invoke === 'function' ? { core: { invoke: invoke as Invoke } } : null;
};

const screen = document.querySelector<HTMLElement>('#shell');
const say = (heading: string, detail: string): void => {
  if (screen === null) return;
  screen.replaceChildren();
  const title = document.createElement('h1');
  title.textContent = heading;
  const body = document.createElement('p');
  body.textContent = detail;
  screen.append(title, body);
};

const shell = tauriGlobal();
if (shell === null) {
  // Opened in an ordinary browser rather than in the app. Worth saying plainly:
  // this bundle is the shell's renderer and has no cloud in it at all, so
  // "nothing happened" would be the most confusing possible outcome.
  say(
    'This window is not the WealthTracker app',
    'The desktop renderer only works inside the shell, which is what provides the ledger.'
  );
} else {
  const invoke = shell.core.invoke;

  const start = (ledger: OpenLedger): void => {
    // No preferences service is passed, and that is honest rather than
    // unfinished: this screen mounts no React and nothing in it reads a setting.
    // `bootDeviceLedger`'s own documentation says what the mount slice owes.
    const document = openDeviceDocument({ ledger, invoke });
    bootDeviceLedger(document)
      .then(boot => {
        say(
          ledger.path,
          `${boot.accounts.length} account(s), ${boot.transactions.length} transaction(s), ` +
            `${boot.categories.length} categor(y/ies). This ledger is open and this window holds it.`
        );
      })
      .catch((error: unknown) => {
        // A refusal's message is the ledger's own prose and a fault's is the
        // transport's sentence. Either way it is shown as it is: seam rule 4
        // reaches all the way out here.
        say('This ledger could not be read', error instanceof Error ? error.message : String(error));
      });
  };

  const choose = (command: 'open_ledger' | 'create_ledger') => (): void => {
    void invoke(command, {})
      .then(answer => start(answer as OpenLedger))
      .catch((error: unknown) => {
        say('No ledger is open', typeof error === 'string' ? error : String(error));
      });
  };

  document.querySelector('#open')?.addEventListener('click', choose('open_ledger'));
  document.querySelector('#create')?.addEventListener('click', choose('create_ledger'));

  // A window that already has one — the shell keeps the document, not the page,
  // so a reload finds it still open.
  void invoke('current_ledger', {}).then(answer => {
    if (answer !== null && answer !== undefined) start(answer as OpenLedger);
  });
}
