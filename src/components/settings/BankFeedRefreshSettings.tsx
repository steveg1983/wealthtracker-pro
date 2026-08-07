import React, { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { RefreshCwIcon } from '../icons';
import {
  loadAutoSyncPrefs,
  saveAutoSyncPrefs,
  DEFAULT_AUTO_SYNC_PREFS,
  type AutoSyncMode,
  type AutoSyncPrefs,
} from '../../utils/bankAutoSync';

/**
 * The automatic bank-feed refresh schedule. Saved per user, per device, the
 * moment it changes — there is nothing to submit. The copy is honest about
 * the one physical limit: a web app can only act while it is open, so a
 * daily time means "the first opportunity on or after that time each day".
 */
export default function BankFeedRefreshSettings(): React.JSX.Element | null {
  const { userId, isSignedIn } = useAuth();
  const [prefs, setPrefs] = useState<AutoSyncPrefs>(() =>
    userId ? loadAutoSyncPrefs(userId) : DEFAULT_AUTO_SYNC_PREFS
  );

  if (!isSignedIn || !userId) return null;

  const update = (next: AutoSyncPrefs): void => {
    setPrefs(next);
    saveAutoSyncPrefs(userId, next);
  };

  const options: Array<{ value: AutoSyncMode; label: string; detail: string }> = [
    {
      value: 'off',
      label: 'Manual only',
      detail: 'Feeds refresh only when you press a refresh button.',
    },
    {
      value: 'signin',
      label: 'When I open the app',
      detail: 'Refreshes on sign-in, at most once an hour.',
    },
    {
      value: 'daily',
      label: 'Once a day at a set time',
      detail: 'Runs at the time below while the app is open — or catches up the next time you open it.',
    },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
      <h2 className="text-xl font-semibold text-theme-heading dark:text-white mb-1 flex items-center gap-2">
        <RefreshCwIcon size={20} className="text-gray-500" />
        Bank feed refresh
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        How your connected banks pull in fresh transactions.
      </p>

      <div role="radiogroup" aria-label="Automatic feed refresh" className="flex flex-col gap-2">
        {options.map(({ value, label, detail }) => (
          <label
            key={value}
            className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
              prefs.mode === value
                ? 'border-[#1a2332] dark:border-blue-500 bg-gray-50 dark:bg-gray-700/50'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <input
              type="radio"
              name="bank-feed-refresh-mode"
              checked={prefs.mode === value}
              onChange={() => update({ ...prefs, mode: value })}
              className="mt-1"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-gray-900 dark:text-white">{label}</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">{detail}</span>
            </span>
          </label>
        ))}
      </div>

      {prefs.mode === 'daily' && (
        <div className="mt-3 flex items-center gap-3 pl-1">
          <label htmlFor="daily-refresh-time" className="text-sm text-gray-700 dark:text-gray-300">
            Refresh at
          </label>
          <input
            id="daily-refresh-time"
            type="time"
            value={prefs.dailyTime}
            onChange={(e) => update({ ...prefs, dailyTime: e.target.value || DEFAULT_AUTO_SYNC_PREFS.dailyTime })}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <span className="text-xs text-gray-400 dark:text-gray-500">every day</span>
        </div>
      )}
    </div>
  );
}
