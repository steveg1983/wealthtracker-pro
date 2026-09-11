import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserId } from './useUserId';
import { isNativeShell } from '../services/push/nativeShell';
import { listenForNotificationTaps, registerThisPhone } from '../services/push/pushRegistration';
import { anyPhoneNotificationOn } from '../services/push/prefs';
import { loadPhoneNotificationPrefs, recordDeviceTimeZone } from '../utils/phoneNotifications';
import { preserveDemoParam } from '../utils/navigation';
import { createScopedLogger } from '../loggers/scopedLogger';

const logger = createScopedLogger('usePhonePushRegistration');

/**
 * The phone keeps its registration current — mounted once, in the cloud
 * chrome's BackgroundWork beside the bank-feed scheduler.
 *
 * On every launch inside the shell, once the person is signed in and has
 * any phone notification switched on: record the zone this phone is in
 * (what "08:30" means to the reminder cron) and re-register the APNs token.
 * A token can rotate between launches, and a row Apple retired comes back
 * when the phone registers again — so this is not a once-ever act but a
 * per-launch one, cheap because iOS answers from its own cache.
 *
 * Does nothing in a browser, nothing signed out, nothing when every switch
 * is off: a person who never asked is never prompted.
 *
 * The second effect is the other direction — a tap on a push carries the
 * path the server chose, and the router goes there. The search string is
 * read at tap time rather than captured at mount, so the demo flag of the
 * page the person is on THEN is the one preserved.
 */
export function usePhonePushRegistration(): void {
  const { databaseId } = useUserId();
  const navigate = useNavigate();

  useEffect(() => {
    if (!databaseId || !isNativeShell()) return;
    if (!anyPhoneNotificationOn(loadPhoneNotificationPrefs())) return;

    let cancelled = false;
    recordDeviceTimeZone();
    void registerThisPhone(databaseId).then((outcome) => {
      if (cancelled) return;
      if (outcome.kind === 'failed') {
        logger.warn('Phone registration did not complete', { message: outcome.message });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [databaseId]);

  useEffect(() => {
    if (!isNativeShell()) return;
    return listenForNotificationTaps((url) => {
      navigate(preserveDemoParam(url, window.location.search));
    });
  }, [navigate]);
}
