import { supabase } from '../api/supabaseClient';
import { createScopedLogger } from '../../loggers/scopedLogger';
import { isNativeShell } from './nativeShell';

/**
 * Registering THIS phone for pushes, and hearing a tap on one.
 *
 * ── HOW A TOKEN REACHES THE SERVER ──────────────────────────────────────────
 *
 * Inside the shell, `@capacitor/push-notifications` talks to the native
 * plugin through the bridge Capacitor injected; `register()` asks iOS for an
 * APNs device token, which arrives as a `registration` event. The token is
 * then upserted into `push_devices` under the person's own row-level policy
 * (migration 20260911170000) — the phone writes its own row, exactly as it
 * writes its own preferences. A re-registration on every launch is how a
 * rotated token gets replaced and a retired row comes back to life.
 *
 * The plugin is imported LAZILY, so a browser never downloads it: the
 * module's static imports are the Supabase client and a logger, both of
 * which every cloud page already has.
 *
 * ── PERMISSION IS ASKED ONCE, BY iOS ────────────────────────────────────────
 *
 * The first `requestPermissions()` shows Apple's own prompt; after that the
 * answer is remembered by the system and the prompt never shows again — a
 * refusal can only be reversed in iOS Settings, which is why the settings
 * panel says so in words rather than offering a button that would do
 * nothing.
 */

const logger = createScopedLogger('pushRegistration');

/** How long to wait for iOS to hand over a token after `register()`. */
const TOKEN_TIMEOUT_MS = 15_000;

export type RegistrationOutcome =
  | { kind: 'registered'; token: string }
  /** iOS has notifications for this app switched off. */
  | { kind: 'denied' }
  /** Not the shell — a browser tab, a home-screen web app, a desktop window. */
  | { kind: 'not-a-phone' }
  | { kind: 'failed'; message: string };

type PushPlugin = typeof import('@capacitor/push-notifications')['PushNotifications'];

const loadPlugin = async (): Promise<PushPlugin> =>
  (await import('@capacitor/push-notifications')).PushNotifications;

/** The token iOS answers `register()` with, or the reason it did not. */
const awaitToken = async (plugin: PushPlugin): Promise<string> => {
  const token = new Promise<string>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('iOS did not hand over a device token in time')),
      TOKEN_TIMEOUT_MS
    );
    void plugin.addListener('registration', (received) => {
      clearTimeout(timer);
      resolve(received.value);
    });
    void plugin.addListener('registrationError', (error) => {
      clearTimeout(timer);
      reject(new Error(error.error));
    });
  });
  await plugin.register();
  return token;
};

export async function registerThisPhone(databaseUserId: string): Promise<RegistrationOutcome> {
  if (!isNativeShell()) return { kind: 'not-a-phone' };
  const client = supabase;
  if (!client) return { kind: 'failed', message: 'No cloud session to register with' };

  try {
    const plugin = await loadPlugin();

    let permission = await plugin.checkPermissions();
    if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') {
      permission = await plugin.requestPermissions();
    }
    if (permission.receive !== 'granted') {
      return { kind: 'denied' };
    }

    const token = await awaitToken(plugin);
    const nowIso = new Date().toISOString();
    const { error } = await client
      .from('push_devices')
      .upsert(
        {
          user_id: databaseUserId,
          platform: 'ios',
          token,
          last_seen_at: nowIso,
          // A phone registering again is a phone that is back, whatever Apple
          // said about its old token.
          disabled_at: null,
          disabled_reason: null,
        },
        { onConflict: 'platform,token' }
      );
    if (error) {
      throw new Error(`Could not save this phone's registration: ${error.message}`);
    }
    logger.info('This phone is registered for notifications');
    return { kind: 'registered', token };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Push registration failed', error instanceof Error ? error : new Error(message));
    return { kind: 'failed', message };
  }
}

/**
 * What iOS says about notifications for this app right now, without asking.
 * 'unknown' is a browser, or a plugin that could not be reached.
 */
export async function notificationPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
  if (!isNativeShell()) return 'unknown';
  try {
    const plugin = await loadPlugin();
    const permission = await plugin.checkPermissions();
    if (permission.receive === 'granted') return 'granted';
    if (permission.receive === 'denied') return 'denied';
    return 'prompt';
  } catch {
    return 'unknown';
  }
}

/**
 * A tap on a push, delivered as the URL the server put in it. Returns the
 * unsubscribe. Every push this app sends carries an in-app path
 * (api/_lib/cloud-refresh-announce.ts, api/_lib/reminder-push.ts); one
 * without is a tap that simply opens the app.
 */
export function listenForNotificationTaps(onUrl: (url: string) => void): () => void {
  if (!isNativeShell()) return () => undefined;
  let removed = false;
  let remove: (() => Promise<void>) | null = null;
  void loadPlugin()
    .then((plugin) =>
      plugin.addListener('pushNotificationActionPerformed', (action) => {
        const url = action.notification.data?.url;
        if (typeof url === 'string' && url.startsWith('/')) onUrl(url);
      })
    )
    .then((handle) => {
      if (removed) void handle.remove();
      else remove = () => handle.remove();
    })
    .catch((error: unknown) => {
      logger.warn('Could not listen for notification taps', error);
    });
  return () => {
    removed = true;
    if (remove) void remove();
  };
}
