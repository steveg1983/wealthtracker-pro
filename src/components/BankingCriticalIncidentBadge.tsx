import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import { AlertTriangleIcon } from './icons';
import { TRUELAYER_JWKS_CIRCUIT_EVENT_PREFIX } from '../constants/bankingOps';
import { bankConnectionService, type BankingApiError } from '../services/bankConnectionService';
import { createScopedLogger } from '../loggers/scopedLogger';

const POLL_INTERVAL_MS = 30000;
const MAX_DISPLAY_COUNT = 99;
type BankingIncidentBadgeMode = 'all' | 'truelayer_jwks';

interface BankingCriticalIncidentBadgeProps {
  onClick?: () => void;
  mode?: BankingIncidentBadgeMode;
}

const isBankingApiError = (value: unknown): value is BankingApiError =>
  typeof value === 'object' &&
  value !== null &&
  'status' in value &&
  typeof (value as { status?: unknown }).status === 'number';

const getDisplayCount = (count: number): string =>
  count > MAX_DISPLAY_COUNT ? `${MAX_DISPLAY_COUNT}+` : String(count);

export default function BankingCriticalIncidentBadge({
  onClick,
  mode = 'all'
}: BankingCriticalIncidentBadgeProps) {
  const [incidentCount, setIncidentCount] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const logger = useMemo(() => createScopedLogger('BankingCriticalIncidentBadge'), []);
  const { getToken } = useClerkAuth();

  useEffect(() => {
    bankConnectionService.setAuthTokenProvider(() => getToken());
  }, [getToken]);

  const loadStats = useCallback(async () => {
    try {
      const response = await bankConnectionService.getOpsAlertStats({
        onlyAboveThreshold: true,
        limit: 1,
        ...(mode === 'truelayer_jwks'
          ? { eventTypePrefix: TRUELAYER_JWKS_CIRCUIT_EVENT_PREFIX }
          : {})
      });

      setIsVisible(true);
      if (!response.threshold.enabled || response.summary.rowsAboveThreshold < 1) {
        setIncidentCount(0);
        return;
      }

      setIncidentCount(response.summary.rowsAboveThreshold);
    } catch (loadError) {
      if (isBankingApiError(loadError) && (loadError.status === 403 || loadError.code === 'forbidden')) {
        setIncidentCount(0);
        setIsVisible(false);
        return;
      }
      logger.warn(`Failed to load compact banking ops alert badge (${mode})`, loadError as Error);
    }
  }, [logger, mode]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    void loadStats();

    const interval = window.setInterval(() => {
      void loadStats();
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [isVisible, loadStats]);

  if (!isVisible || incidentCount < 1) {
    return null;
  }

  const countLabel = getDisplayCount(incidentCount);
  const badgeText = mode === 'truelayer_jwks'
    ? `${countLabel} JWKS incident${incidentCount === 1 ? '' : 's'}`
    : `${countLabel} critical incident${incidentCount === 1 ? '' : 's'}`;
  const sharedClassName = mode === 'truelayer_jwks'
    ? 'inline-flex items-center gap-1 rounded-full border border-amber-200 dark:border-amber-800 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2.5 py-1 text-xs font-semibold'
    : 'inline-flex items-center gap-1 rounded-full border border-red-200 dark:border-red-800 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2.5 py-1 text-xs font-semibold';
  const badgeTitle = mode === 'truelayer_jwks'
    ? `${incidentCount} TrueLayer JWKS incident(s) above suppression threshold`
    : `${incidentCount} banking incident(s) above suppression threshold`;

  const hoverClassName = mode === 'truelayer_jwks'
    ? 'hover:bg-amber-200 dark:hover:bg-amber-900/40'
    : 'hover:bg-red-200 dark:hover:bg-red-900/40';

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${sharedClassName} ${hoverClassName} transition-colors`}
        title={badgeTitle}
        aria-label={badgeText}
      >
        <AlertTriangleIcon size={14} />
        <span>{badgeText}</span>
      </button>
    );
  }

  return (
    <span
      className={sharedClassName}
      title={badgeTitle}
      aria-label={badgeText}
    >
      <AlertTriangleIcon size={14} />
      <span>{badgeText}</span>
    </span>
  );
}
