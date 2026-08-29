import React, { useState, useEffect } from 'react';
import { getUserLocale, setUserLocale, formatShortDate, getDateFormatPlaceholder } from '../../utils/dateFormatter';
import { preferences } from '../../services/preferencesService';
import { CalendarIcon, GlobeIcon } from '../icons';

interface LocaleSelectorProps {
  onLocaleChange?: (locale: string) => void;
  /**
   * Rendered inside this card, under the date-format note: Base Currency
   * belongs WITH region, not in a card of its own (owner, 28 Aug) — what
   * money you count in is the same kind of decision as where you are.
   */
  children?: React.ReactNode;
}

const SUPPORTED_LOCALES = [
  { code: 'en-US', name: 'English (United States)', dateFormat: 'mm/dd/yyyy', example: '12/31/2024' },
  { code: 'en-GB', name: 'English (United Kingdom)', dateFormat: 'dd/mm/yyyy', example: '31/12/2024' },
  { code: 'en-AU', name: 'English (Australia)', dateFormat: 'dd/mm/yyyy', example: '31/12/2024' },
  { code: 'en-CA', name: 'English (Canada)', dateFormat: 'yyyy-mm-dd', example: '2024-12-31' },
  { code: 'en-IE', name: 'English (Ireland)', dateFormat: 'dd/mm/yyyy', example: '31/12/2024' },
  { code: 'en-NZ', name: 'English (New Zealand)', dateFormat: 'dd/mm/yyyy', example: '31/12/2024' },
  { code: 'en-IN', name: 'English (India)', dateFormat: 'dd/mm/yyyy', example: '31/12/2024' },
  { code: 'en-ZA', name: 'English (South Africa)', dateFormat: 'dd/mm/yyyy', example: '31/12/2024' },
];

export default function LocaleSelector({ onLocaleChange, children }: LocaleSelectorProps): React.JSX.Element {
  const [currentLocale, setCurrentLocale] = useState(getUserLocale());
  const [showPreview, setShowPreview] = useState(false);
  const [previewDate] = useState(new Date());

  useEffect(() => {
    setCurrentLocale(getUserLocale());
  }, []);

  const handleLocaleChange = async (locale: string): Promise<void> => {
    setUserLocale(locale);
    setCurrentLocale(locale);
    if (onLocaleChange) {
      onLocaleChange(locale);
    }

    // WAIT FOR THE WRITE BEFORE THROWING THE PAGE AWAY.
    //
    // `setUserLocale` puts the choice in memory and schedules the write on an
    // 800ms debounce. Reloading in the same tick destroyed the timer before it
    // ever fired, so the choice reached the mirror and nothing else — and on
    // the DESKTOP edition that was fatal rather than merely unlucky: the
    // ledger file is attached before the first render, and once the store is
    // loaded it stops consulting the mirror by design. The stored value was
    // therefore unreadable, `getUserLocale` fell through to `navigator.language`,
    // and the dropdown snapped back to whatever the machine's OS was set to,
    // every time. (Measured on a Mac set to en-US and a Windows VM set to
    // en-GB; each would only ever show its own OS locale.)
    //
    // The web edition got away with it because it attaches preferences
    // lazily, after Clerk resolves, so the mirror was still being read.
    await preferences.flush();
    // Reload to apply the new locale to already-formatted dates.
    window.location.reload();
  };

  const currentLocaleInfo = SUPPORTED_LOCALES.find(l => l.code === currentLocale) || SUPPORTED_LOCALES[0];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-3 mb-4">
        <GlobeIcon size={24} className="text-gray-600 dark:text-gray-400" />
        <div>
          {/* "Region & Date Format" — the card's own first control says
              "Select Your Region", and a heading should name what is inside
              it (owner, 28 Aug). */}
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Region & Date Format
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Choose your region, date format and base currency
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="locale-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Your Region
          </label>
          <select
            id="locale-select"
            value={currentLocale}
            onChange={(e) => { void handleLocaleChange(e.target.value); }}
            className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
          >
            {SUPPORTED_LOCALES.map((locale) => (
              <option key={locale.code} value={locale.code}>
                {locale.name}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarIcon size={18} className="text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Current Date Format
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Format Pattern</p>
              <p className="text-sm font-mono text-gray-900 dark:text-white bg-white dark:bg-gray-800 px-3 py-2 rounded border border-gray-200 dark:border-gray-600">
                {currentLocaleInfo.dateFormat}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Example</p>
              <p className="text-sm font-mono text-gray-900 dark:text-white bg-white dark:bg-gray-800 px-3 py-2 rounded border border-gray-200 dark:border-gray-600">
                {currentLocaleInfo.example}
              </p>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="text-sm text-primary hover:text-secondary font-medium"
          >
            {showPreview ? 'Hide' : 'Show'} Live Preview
          </button>
          
          {showPreview && (
            <div className="mt-4 space-y-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Today's Date</p>
                <p className="text-sm text-gray-900 dark:text-white">
                  {formatShortDate(previewDate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Input Placeholder</p>
                <input
                  type="text"
                  placeholder={getDateFormatPlaceholder()}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                  disabled
                />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Long Format</p>
                <p className="text-sm text-gray-900 dark:text-white">
                  {previewDate.toLocaleDateString(currentLocale, { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex gap-2">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="h-4 w-4 text-gray-500 dark:text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-sm text-gray-800 dark:text-gray-200">
              <p className="font-medium mb-1">Note</p>
              <p className="text-xs">
                Date format will be applied throughout the application. 
                The page will reload to apply your changes.
              </p>
            </div>
          </div>
        </div>

        {children && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">{children}</div>
        )}
      </div>
    </div>
  );
}