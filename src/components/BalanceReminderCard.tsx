import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BellIcon } from './icons';
import { preserveDemoParam } from '../utils/navigation';
import {
  acknowledgeReminder,
  loadReminderPrefs,
  loadReminderState,
  reminderDue,
  snoozeReminderUntilTomorrow,
} from '../utils/balanceReminders';

/**
 * The balance reminder, where the owner asked for it (29 Aug): "something
 * needs to pop up on the screen, whatever page you are on" — not a line in
 * the notifications bell. Mounted once in Layout beside the other floating
 * surfaces, so every page is "whatever page you are on".
 *
 * CENTRE of the screen, over a scrim — the owner's correction after the
 * first version floated bottom-right and he "didn't even see it at first",
 * which for a card whose whole brief is being seen is the one failure that
 * matters. Still not a modal in behaviour: it takes no focus and traps
 * nothing, and its three buttons are the ways out (the scrim deliberately
 * answers no clicks — a silent click-away would either write state nobody
 * chose or bring the card straight back). It is entirely self-inflicted:
 * it exists only on the schedule the user set in Settings → App Settings,
 * which is off until they say otherwise.
 *
 * Three answers, each honest about what it does:
 *   Update balances — go to Accounts, and the job is taken as being done
 *     there (the reminder does not follow you to nag mid-task);
 *   Done — already up to date, nothing to visit;
 *   Tomorrow — literally tomorrow at the scheduled time, on every device,
 *     because the acknowledgement travels with the user (see
 *     utils/balanceReminders for why that differs from the bank sync).
 *
 * The schedule is re-checked once a minute while the app sits open — the same
 * cadence as useAutoBankSync, and the same honesty about being a web page: a
 * moment that passes while the app is closed is caught up on the next open.
 */

const CHECK_INTERVAL_MS = 60_000;

export default function BalanceReminderCard(): React.JSX.Element | null {
  const navigate = useNavigate();
  const location = useLocation();
  const [due, setDue] = useState(false);

  useEffect(() => {
    const check = (): void => {
      setDue(reminderDue(loadReminderPrefs(), loadReminderState(), new Date()));
    };
    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  if (!due) return null;

  const settle = (): void => {
    acknowledgeReminder(new Date());
    setDue(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        role="status"
        aria-label="Balance reminder"
        className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-line dark:border-gray-600 p-5"
      >
      <div className="flex items-start gap-3">
        <BellIcon size={18} className="mt-0.5 shrink-0 text-gray-500 dark:text-gray-400" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Time to update your account balances
          </h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Your scheduled reminder — bring any balances the app cannot see up
            to date, so your net worth stays honest.
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            snoozeReminderUntilTomorrow(loadReminderPrefs(), new Date());
            setDue(false);
          }}
          className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg"
        >
          Tomorrow
        </button>
        <button
          type="button"
          onClick={settle}
          className="px-3 py-1.5 text-sm font-medium border border-line dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Done
        </button>
        <button
          type="button"
          onClick={() => {
            settle();
            navigate(preserveDemoParam('/accounts', location.search));
          }}
          className="px-3 py-1.5 text-sm font-medium bg-primary-action text-on-primary-action rounded-lg transition-colors"
        >
          Update balances
        </button>
        </div>
      </div>
    </div>
  );
}
