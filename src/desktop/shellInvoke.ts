/**
 * The shell's one door, made reachable from inside the mounted application.
 *
 * `DesktopApp` is handed `invoke` as a prop and `tauriShell.ts` is the only
 * module that reads the Tauri global — deliberately, so that a window's door is
 * injected once and every test supplies its own. `MountedLedger` takes no props
 * (it is `lazy()`-imported and mounts the whole product), so a surface inside it
 * that needs the SHELL rather than the LEDGER has nowhere to be handed one.
 *
 * This is that hand-off, and it is a context rather than a second call to
 * `tauriInvoke()` for one reason: a second reader of `window.__TAURI__` would be
 * a second door, and the point of there being one is that a test can close it.
 *
 * It carries the SHELL's commands — `license_status`, `license_apply`,
 * `shell_build` — and never the ledger's. Everything a screen wants to know
 * about money still arrives through `@data`, and always will: `deviceDataPort.ts`
 * is the edition seam and this is not a way round it.
 */

import { createContext, useContext } from 'react';
import type { Invoke } from '../services/local/coreTransport';

/**
 * The shell, or `null` when there is not one — a renderer opened in an ordinary
 * browser, or a test that did not provide one. Surfaces that use it render
 * nothing rather than failing; see `licence.ts`'s header on why that is the
 * right amount of noise.
 */
export const ShellInvokeContext = createContext<Invoke | null>(null);

/** The shell's door, from inside the mounted application. */
export const useShellInvoke = (): Invoke | null => useContext(ShellInvokeContext);
