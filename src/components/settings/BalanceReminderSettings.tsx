import React, { useState } from 'react';
import { BellIcon } from '../icons';
import {
  DEFAULT_REMINDER_PREFS,
  loadReminderPrefs,
  saveReminderPrefs,
  type BalanceReminderPrefs,
  type ReminderSchedule,
} from '../../utils/balanceReminders';

/**
 * Balance-update reminders — the schedule half of the owner's 29 Aug ask
 * ("keep your accounts in check"); the in-your-face half is
 * BalanceReminderCard. Sits directly under the bank feed refresh, whose shape
 * this mirrors: saved the moment it changes, honest about the web-app limit
 * (the card can only appear while the app is open — it catches up on the next
 * open otherwise), and off by default because a nag nobody asked for is not a
 * feature.
 */

const WEEKDAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

/** "1st", "2nd" … "28th" — en-GB ordinals for the monthly picker. */
const ordinal = (n: number): string => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
};

export default function BalanceReminderSettings(): React.JSX.Element {
  const [prefs, setPrefs] = useState<BalanceReminderPrefs>(loadReminderPrefs);

  const update = (next: BalanceReminderPrefs): void => {
    setPrefs(next);
    saveReminderPrefs(next, new Date());
  };

  const options: Array<{ value: ReminderSchedule; label: string; detail: string }> = [
    {
      value: 'off',
      label: 'Off',
      detail: 'No reminders.',
    },
    {
      value: 'daily',
      label: 'Daily',
      detail: 'A reminder every day at the time below.',
    },
    {
      value: 'weekly',
      label: 'Weekly',
      detail: 'A reminder on the day of the week you choose.',
    },
    {
      value: 'monthly',
      label: 'Monthly',
      detail: 'A reminder on the day of the month you choose.',
    },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
      <h2 className="text-xl font-semibold text-theme-heading dark:text-white mb-1 flex items-center gap-2">
        <BellIcon size={20} className="text-gray-500" />
        Balance reminders
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        A reminder to update your account balances, on whatever page you are on.
        If the app is closed at the time, it appears the next time you open it.
      </p>

      <div role="radiogroup" aria-label="Balance reminder schedule" className="flex flex-col gap-2">
        {options.map(({ value, label, detail }) => (
          <label
            key={value}
            className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
              prefs.schedule === value
                ? 'border-[#1a2332] dark:border-[#94a3b8] bg-gray-50 dark:bg-gray-700/50'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <input
              type="radio"
              name="balance-reminder-schedule"
              checked={prefs.schedule === value}
              onChange={() => update({ ...prefs, schedule: value })}
              className="mt-1"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-gray-900 dark:text-white">{label}</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">{detail}</span>
            </span>
          </label>
        ))}
      </div>

      {prefs.schedule !== 'off' && (
        <div className="mt-3 flex flex-wrap items-center gap-3 pl-1">
          <label htmlFor="balance-reminder-time" className="text-sm text-gray-700 dark:text-gray-300">
            Remind at
          </label>
          <input
            id="balance-reminder-time"
            type="time"
            value={prefs.time}
            onChange={(e) =>
              update({ ...prefs, time: e.target.value || DEFAULT_REMINDER_PREFS.time })
            }
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          {prefs.schedule === 'weekly' && (
            <>
              <label htmlFor="balance-reminder-weekday" className="text-sm text-gray-700 dark:text-gray-300">
                every
              </label>
              <select
                id="balance-reminder-weekday"
                value={prefs.weekday}
                onChange={(e) => update({ ...prefs, weekday: Number(e.target.value) })}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {WEEKDAYS.map((day, index) => (
                  <option key={day} value={index}>{day}</option>
                ))}
              </select>
            </>
          )}
          {prefs.schedule === 'monthly' && (
            <>
              <label htmlFor="balance-reminder-monthday" className="text-sm text-gray-700 dark:text-gray-300">
                on the
              </label>
              <select
                id="balance-reminder-monthday"
                value={prefs.monthDay}
                onChange={(e) => update({ ...prefs, monthDay: Number(e.target.value) })}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {/* To the 28th, so the schedule means the same thing every
                    month — see the prefs type. */}
                {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>{ordinal(day)}</option>
                ))}
              </select>
              <span className="text-xs text-gray-400 dark:text-gray-500">of the month</span>
            </>
          )}
          {prefs.schedule === 'daily' && (
            <span className="text-xs text-gray-400 dark:text-gray-500">every day</span>
          )}
        </div>
      )}
    </div>
  );
}
