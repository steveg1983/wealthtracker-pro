/**
 * THE register table — one rendering of a derived SecurityRegister, shared
 * by SecurityHistoryModal (imported history) and HoldingRegisterModal (a
 * live holding once it has events, slice 4), so the two can never draw the
 * same trade differently.
 *
 * The table and its totals only; the modals own their chrome, their price
 * loading and (for a live holding) the Revalue and trade forms.
 */
import type { SecurityRegister, SecurityRegisterLine } from '../services/investments/securityRegister';
import type { HoldingPricePoint } from '../services/investments/holdingRegister';
import { formatCurrency, formatUnitPrice } from '../utils/currency-decimal';

interface SecurityRegisterTableProps {
  register: SecurityRegister;
  currency: string;
  /** Null for a security with no ticker — the footer says what that means. */
  symbol: string | null;
  /**
   * Offered on trade lines when the surface can act on it — the LIVE
   * holding's register passes this; the imported-history modal does not, so
   * a read-only history stays read-only. Receives the event the line derives
   * from and the date it currently claims (owner, 30 Aug: a buy recorded
   * with the wrong date could only be fixed by deleting the whole holding).
   */
  onMoveDate?: (eventId: string, currentDate: string) => void;
  /**
   * Offered beside the date's 'change' on the same lines: delete the trade
   * outright (owner, 30 Aug: a buy recorded against the wrong fund — "my
   * only option is to 'sell some' but I dont want to do that, I want to
   * delete it"). Deletion is not a sale: nothing is realised.
   */
  onDeleteEvent?: (eventId: string, kind: SecurityRegisterLine['kind']) => void;
}

const EVENT_WORD: Record<SecurityRegisterLine['kind'], string> = {
  buy: 'Buy',
  sell: 'Sell',
  write_off: 'Written off — worthless',
  revaluation: 'Revaluation'
};

const SOURCE_WORD: Record<HoldingPricePoint['source'], string> = {
  quote: 'quoted',
  manual: 'you set this',
  trade: 'from a trade',
  import: 'imported'
};

export default function SecurityRegisterTable({
  register,
  currency,
  symbol,
  onMoveDate,
  onDeleteEvent
}: SecurityRegisterTableProps): React.JSX.Element {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="py-2 pr-3 font-medium">Date</th>
              <th className="py-2 px-3 font-medium">Event</th>
              <th className="py-2 px-3 text-right font-medium">Units</th>
              <th className="py-2 px-3 text-right font-medium">Price</th>
              <th className="py-2 px-3 text-right font-medium">Amount</th>
              <th className="py-2 pl-3 text-right font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {register.lines.map((line, index) => {
              const movableEventId = onMoveDate !== undefined ? line.eventId : undefined;
              const deleteEvent = onDeleteEvent;
              const deletableEventId = deleteEvent !== undefined ? line.eventId : undefined;
              return (
              <tr
                key={`${line.date}-${index}`}
                className="border-b border-gray-100 dark:border-gray-700/50 last:border-0"
              >
                {/* nowrap: a date split across lines ("2010-04-␍19") is what
                    the owner's first real screenshot showed. The table's
                    overflow container scrolls instead. */}
                <td className="py-2 pr-3 tabular-nums whitespace-nowrap text-gray-900 dark:text-white">
                  {line.date}
                  {onMoveDate !== undefined && movableEventId !== undefined && (
                    <button
                      type="button"
                      onClick={() => onMoveDate(movableEventId, line.date)}
                      aria-label={`Change the date of this ${EVENT_WORD[line.kind].toLowerCase()}`}
                      className="ml-2 text-xs text-gray-500 dark:text-gray-400 underline underline-offset-2 hover:text-gray-900 dark:hover:text-white"
                    >
                      change
                    </button>
                  )}
                  {deleteEvent !== undefined && deletableEventId !== undefined && (
                    <button
                      type="button"
                      onClick={() => deleteEvent(deletableEventId, line.kind)}
                      aria-label={`Delete this ${EVENT_WORD[line.kind].toLowerCase()}`}
                      className="ml-1 text-xs text-gray-500 dark:text-gray-400 underline underline-offset-2 hover:text-expense"
                    >
                      delete
                    </button>
                  )}
                </td>
                <td className="py-2 px-3 text-gray-700 dark:text-gray-300">
                  {line.kind === 'revaluation'
                    ? `Revaluation — ${SOURCE_WORD[line.source as HoldingPricePoint['source']] ?? 'recorded'}`
                    : EVENT_WORD[line.kind]}
                  {line.realised !== null && (
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      Realised {formatCurrency(line.realised, currency)}
                    </span>
                  )}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-gray-900 dark:text-white">
                  {line.quantityAfter.toString()}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-gray-900 dark:text-white">
                  {line.price === null ? '—' : formatUnitPrice(line.price, currency)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-gray-900 dark:text-white">
                  {line.amount.isZero() && line.kind === 'write_off'
                    ? '—'
                    : formatCurrency(line.amount, currency)}
                </td>
                <td className="py-2 pl-3 text-right tabular-nums text-gray-900 dark:text-white">
                  {formatCurrency(line.runningValue, currency)}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-1">
        <p className="text-body text-gray-500 dark:text-gray-400">
          Bought {formatCurrency(register.invested, currency)} · Sold{' '}
          {formatCurrency(register.proceeds, currency)} · Realised{' '}
          {formatCurrency(register.realisedGain, currency)}
          {register.endQuantity.isZero()
            ? ''
            : ` · Still held: ${register.endQuantity.toString()} units, ${formatCurrency(register.endValue, currency)}`}
        </p>
        {symbol === null && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            This security has no ticker symbol, so there is no price history — the register is its
            trades.
          </p>
        )}
        {register.skipped.pricesWhileNothingHeld > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {register.skipped.pricesWhileNothingHeld} price
            {register.skipped.pricesWhileNothingHeld === 1 ? '' : 's'} fell in a stretch when nothing
            was held and moved nothing.
          </p>
        )}
        {register.skipped.pricesInOtherCurrency > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {register.skipped.pricesInOtherCurrency} price
            {register.skipped.pricesInOtherCurrency === 1 ? '' : 's'} in another currency
            {register.skipped.pricesInOtherCurrency === 1 ? ' is' : ' are'} not drawn — this register
            speaks the account&rsquo;s money.
          </p>
        )}
        {register.skipped.soldMoreThanHeld > 0 && (
          <p className="text-xs text-red-700 dark:text-red-400">
            {register.skipped.soldMoreThanHeld} sale
            {register.skipped.soldMoreThanHeld === 1 ? '' : 's'} exceeded the units held and
            {register.skipped.soldMoreThanHeld === 1 ? ' was' : ' were'} clamped — this history does
            not fold cleanly.
          </p>
        )}
      </div>
    </>
  );
}
