import type { SupabaseClient } from '@supabase/supabase-js';
import {
  apnsConfig,
  sendApnsAlert,
  type ApnsAlert,
  type ApnsEnvironment,
  type ApnsResult
} from './apns.js';
import { parsePreferencesDocument } from '../../src/services/preferences/document.js';

/**
 * Telling a person's phones something — every enabled device, and the
 * housekeeping Apple's answers call for.
 *
 * ── THE RULES, ONE PER ANSWER ───────────────────────────────────────────────
 *
 *   sent          done.
 *   unregistered  Apple will never deliver to this token again (the app was
 *                 removed, or the token rotated and the phone has registered
 *                 a new one). The row is RETIRED with the reason, not
 *                 deleted, so a late upsert from an old launch cannot bring
 *                 it back.
 *   bad_token     usually the OTHER environment's token: a TestFlight build
 *                 registers a production token, a build run from Xcode a
 *                 sandbox one, and the phone cannot tell us which. So the
 *                 other host is tried ONCE; if that delivers, the row
 *                 remembers its environment; if not, the token is bad
 *                 everywhere and the row is retired.
 *   auth_failed   OUR key was refused. Nothing about the device; counted
 *                 as a failure, and loud in the log, because every push to
 *                 every phone is failing the same way.
 *   failed        Apple had a bad moment (5xx, 429) or could not be reached.
 *                 Counted, not retried here — the next cron run is the retry.
 *
 * Written over injected verbs (PushDeps) so the rules run under vitest
 * without Apple or a database; `pushDeps` binds them to both.
 */

export type PushNote = ApnsAlert;

export interface PushDeviceRow {
  id: string;
  token: string;
  apns_environment: ApnsEnvironment;
}

export interface PushDeps {
  listEnabledDevices: (userId: string) => Promise<PushDeviceRow[]>;
  send: (device: PushDeviceRow, environment: ApnsEnvironment, note: PushNote) => Promise<ApnsResult>;
  retireDevice: (deviceId: string, reason: string) => Promise<void>;
  rememberEnvironment: (deviceId: string, environment: ApnsEnvironment) => Promise<void>;
}

export interface NotifyOutcome {
  devices: number;
  sent: number;
  retired: number;
  failed: number;
}

const otherEnvironment = (environment: ApnsEnvironment): ApnsEnvironment =>
  environment === 'production' ? 'sandbox' : 'production';

export const notifyUser = async (deps: PushDeps, userId: string, note: PushNote): Promise<NotifyOutcome> => {
  const devices = await deps.listEnabledDevices(userId);
  const outcome: NotifyOutcome = { devices: devices.length, sent: 0, retired: 0, failed: 0 };

  for (const device of devices) {
    let result: ApnsResult;
    try {
      result = await deps.send(device, device.apns_environment, note);
      if (result.kind === 'bad_token') {
        const retried = await deps.send(device, otherEnvironment(device.apns_environment), note);
        if (retried.kind === 'sent') {
          await deps.rememberEnvironment(device.id, otherEnvironment(device.apns_environment));
        }
        result = retried.kind === 'sent' ? retried : result;
      }
    } catch (error) {
      console.error('[push] could not reach APNs', {
        deviceId: device.id,
        message: error instanceof Error ? error.message : String(error)
      });
      outcome.failed += 1;
      continue;
    }

    switch (result.kind) {
      case 'sent':
        outcome.sent += 1;
        break;
      case 'unregistered':
      case 'bad_token':
        await deps.retireDevice(device.id, result.reason);
        outcome.retired += 1;
        break;
      case 'auth_failed':
        console.error('[push] APNs refused our provider token — check APNS_TEAM_ID / APNS_KEY_ID / APNS_PRIVATE_KEY / APNS_BUNDLE_ID', {
          reason: result.reason
        });
        outcome.failed += 1;
        break;
      case 'failed':
        console.warn('[push] APNs did not accept a push', { deviceId: device.id, status: result.status, reason: result.reason });
        outcome.failed += 1;
        break;
    }
  }

  return outcome;
};

/**
 * The verbs bound to Supabase and Apple — or null when APNs is not
 * configured, which every caller treats as "skip, say so once, carry on".
 */
export const pushDeps = (supabase: SupabaseClient): PushDeps | null => {
  const config = apnsConfig();
  if (!config) return null;
  return {
    listEnabledDevices: async (userId) => {
      const { data, error } = await supabase
        .from('push_devices')
        .select('id, token, apns_environment')
        .eq('user_id', userId)
        .is('disabled_at', null);
      if (error) throw new Error(`Failed to list push devices: ${error.message}`);
      return (data ?? []) as PushDeviceRow[];
    },
    send: (device, environment, note) => sendApnsAlert(config, environment, device.token, note),
    retireDevice: async (deviceId, reason) => {
      const { error } = await supabase
        .from('push_devices')
        .update({ disabled_at: new Date().toISOString(), disabled_reason: reason.slice(0, 200) })
        .eq('id', deviceId);
      if (error) throw new Error(`Failed to retire push device: ${error.message}`);
    },
    rememberEnvironment: async (deviceId, environment) => {
      const { error } = await supabase
        .from('push_devices')
        .update({ apns_environment: environment })
        .eq('id', deviceId);
      if (error) throw new Error(`Failed to record push environment: ${error.message}`);
    }
  };
};

/**
 * The preference documents of several users at once, parsed — what a cron
 * reads to learn who asked for which push. Users without a row are absent
 * from the map, which every caller reads as "asked for nothing".
 */
export const loadPreferenceValues = async (
  supabase: SupabaseClient,
  userIds: readonly string[]
): Promise<Map<string, Record<string, string>>> => {
  const values = new Map<string, Record<string, string>>();
  if (userIds.length === 0) return values;
  const { data, error } = await supabase
    .from('user_preferences')
    .select('user_id, prefs')
    .in('user_id', [...userIds]);
  if (error) throw new Error(`Failed to load preferences: ${error.message}`);
  for (const row of (data ?? []) as Array<{ user_id: string; prefs: unknown }>) {
    values.set(row.user_id, parsePreferencesDocument(row.prefs).values);
  }
  return values;
};

/** Every user with at least one phone still listening. */
export const usersWithEnabledDevices = async (supabase: SupabaseClient): Promise<string[]> => {
  const { data, error } = await supabase
    .from('push_devices')
    .select('user_id')
    .is('disabled_at', null);
  if (error) throw new Error(`Failed to list push users: ${error.message}`);
  return [...new Set(((data ?? []) as Array<{ user_id: string }>).map((row) => row.user_id))];
};
