/**
 * One security's full trading register — the Microsoft Money shape for a
 * position that was TRADED, derived live from its imported events and its
 * price series (buildSecurityRegister holds the arithmetic and the rulings;
 * nothing here is stored).
 *
 * Opened from a portfolio's "Securities traded" list. Read-only by design:
 * the trades are imported history, and revaluing belongs to the holdings
 * that exist today (HoldingRegisterModal's Revalue form), not to a closed
 * story. The table itself is SecurityRegisterTable, shared with the live
 * holding's register so the two can never draw the same trade differently.
 */
import { useEffect, useMemo, useState } from 'react';
import { dataPort } from '@data';
import { Modal, ModalBody } from './common/Modal';
import { buildSecurityRegister } from '../services/investments/securityRegister';
import SecurityRegisterTable from './SecurityRegisterTable';
import type { InvestmentEvent } from '../services/investments/events';
import type { HoldingPricePoint } from '../services/investments/holdingRegister';

interface SecurityHistoryModalProps {
  symbol: string | null;
  securityName: string;
  currency: string;
  /** This security's events in this account — the opener already has them. */
  events: InvestmentEvent[];
  onClose: () => void;
}

export default function SecurityHistoryModal({
  symbol,
  securityName,
  currency,
  events,
  onClose
}: SecurityHistoryModalProps): React.JSX.Element {
  const [series, setSeries] = useState<HoldingPricePoint[] | null>(symbol === null ? [] : null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (symbol === null) return; // no ticker, no series — trades-only, honestly
    let cancelled = false;
    void (async () => {
      try {
        const prices = await dataPort.listInvestmentPrices(symbol);
        if (!cancelled) setSeries(prices);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'The price history could not be read.');
          setSeries([]); // the trades still stand on their own
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const register = useMemo(
    () => (series === null ? null : buildSecurityRegister(events, series)),
    [events, series]
  );

  const title = symbol === null ? `${securityName} — register` : `${symbol} — register`;

  return (
    <Modal isOpen onClose={onClose} title={title} size="lg">
      <ModalBody>
        <div className="space-y-4">
          {loadError && (
            <p role="alert" className="text-body text-red-700 dark:text-red-400">
              {loadError} The trades below still stand.
            </p>
          )}

          {register === null && (
            <p className="text-body text-gray-500 dark:text-gray-400">Reading the price history…</p>
          )}

          {register && <SecurityRegisterTable register={register} currency={currency} symbol={symbol} />}
        </div>
      </ModalBody>
    </Modal>
  );
}
