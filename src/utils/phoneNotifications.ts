/**
 * Phone notifications: the browser's half of the preference.
 *
 * The shape and the parser are services/push/prefs.ts (pure, shared with the
 * server that decides whether to send). This is where the document is read
 * and written from a page — the same split utils/bankAutoSync.ts and
 * utils/balanceReminders.ts make, and for the same reason: the choice
 * belongs to the person and travels with the account.
 */

import { preferences } from '../services/preferencesService';
import {
  parsePhoneNotificationPrefs,
  DEVICE_TIME_ZONE_KEY,
  PHONE_NOTIFICATION_PREFS_KEY,
  type PhoneNotificationPrefs,
} from '../services/push/prefs';
import { hostTimeZone } from '../services/reminders/schedule';

export function loadPhoneNotificationPrefs(): PhoneNotificationPrefs {
  return parsePhoneNotificationPrefs(preferences.getItem(PHONE_NOTIFICATION_PREFS_KEY));
}

export function savePhoneNotificationPrefs(prefs: PhoneNotificationPrefs): void {
  preferences.setItem(PHONE_NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
}

/**
 * Tell the server where this phone is, so "remind me at 08:30" means 08:30
 * here. Written whenever the phone registers for pushes; a phone that moves
 * zones rewrites it on its next launch.
 */
export function recordDeviceTimeZone(): void {
  preferences.setItem(DEVICE_TIME_ZONE_KEY, hostTimeZone());
}
