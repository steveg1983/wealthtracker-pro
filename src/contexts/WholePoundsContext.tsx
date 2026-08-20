/* eslint-disable react-refresh/only-export-components -- a context file
   exports its hook beside its provider, exactly as PreferencesContext does */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { preferences } from '../services/preferencesService';

/**
 * WHOLE POUNDS, PER PAGE.
 *
 * The owner's ask (19 Aug): "a check box somewhere to offer the user to hide
 * decimal points. Sometimes, when looking at a lot of data, it is cleaner to
 * look at rounded whole figures" — refined a message later to "the decimal
 * display should be PAGE specific". So this is a SCOPE, not a global switch:
 * each page wraps itself in one, remembers its own answer under its own key,
 * and everything inside — the page's own figures and every widget it mounts —
 * follows, because useCurrencyDecimal reads this context where it is called.
 *
 * Pennies are a DISPLAY choice here and nothing else: the ledger, exports,
 * inputs and tooltips keep their exactness; only what formatCurrency prints
 * inside a scope rounds (half-up, in utils/currency-decimal).
 */

interface WholePoundsScopeValue {
  wholePounds: boolean;
  setWholePounds: (value: boolean) => void;
}

/** Outside any scope: pennies stay, and the toggle (if rendered) does nothing. */
const WholePoundsContext = createContext<WholePoundsScopeValue>({
  wholePounds: false,
  setWholePounds: () => {},
});

/** What useCurrencyDecimal reads: is this render inside a whole-pounds scope that is ON? */
export const useWholePoundsDisplay = (): boolean => useContext(WholePoundsContext).wholePounds;

/**
 * One page's scope. `page` is the storage key's tail — give each page its own
 * stable name ('dashboard', 'accounts', …) and its choice survives the session
 * through the preferences document like every other display preference.
 */
export function WholePoundsScope({ page, children }: { page: string; children: ReactNode }): React.JSX.Element {
  const key = `money_management_whole_pounds_${page}`;
  const [wholePounds, setState] = useState((): boolean => preferences.getItem(key) === 'true');
  const setWholePounds = useCallback((value: boolean): void => {
    setState(value);
    preferences.setItem(key, value ? 'true' : 'false');
  }, [key]);
  const value = useMemo(() => ({ wholePounds, setWholePounds }), [wholePounds, setWholePounds]);
  return <WholePoundsContext.Provider value={value}>{children}</WholePoundsContext.Provider>;
}

/**
 * The checkbox. Context-connected so a page can drop it into whichever
 * toolbar suits without threading props through a 3,000-line component.
 * Reads "Hide decimals" (owner, 20 Aug, over the first wording): unticked
 * shows the pennies, ticked hides them.
 */
export function WholePoundsToggle({ className = '' }: { className?: string }): React.JSX.Element {
  const { wholePounds, setWholePounds } = useContext(WholePoundsContext);
  return (
    <label className={`flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer select-none ${className}`}>
      <input
        type="checkbox"
        checked={wholePounds}
        onChange={event => setWholePounds(event.target.checked)}
        className="rounded border-gray-300 dark:border-gray-600"
      />
      Hide decimals
    </label>
  );
}
