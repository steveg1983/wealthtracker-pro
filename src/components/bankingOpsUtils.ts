import { format } from 'date-fns';
import type { BankingApiError } from '../services/bankConnectionService';
import type { BankingAuditDateRangePreset } from '../utils/bankingOpsUrlState';

export const AUDIT_DATE_RANGE_PRESET_TO_MS = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000
} as const;

export type AuditDateRangePreset = BankingAuditDateRangePreset | '';
export type AuditScopeValue = 'single' | 'bulk' | 'all_dead_lettered' | '';

export const copyToClipboard = async (value: string): Promise<void> => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard API is unavailable');
  }

  const input = document.createElement('textarea');
  input.value = value;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.focus();
  input.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(input);
  if (!copied) {
    throw new Error('Copy failed');
  }
};

export const isBankingApiError = (value: unknown): value is BankingApiError =>
  typeof value === 'object' &&
  value !== null &&
  'status' in value &&
  typeof (value as { status?: unknown }).status === 'number';

export const formatTimestamp = (value: string | null): string => {
  if (!value) {
    return 'n/a';
  }
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return value;
  }
  return format(timestamp, 'MMM d, yyyy HH:mm');
};

export const parseAuditDateRangePreset = (value: string): AuditDateRangePreset => (
  value === '24h' || value === '7d' || value === '30d' ? value : ''
);

export const parseAuditStatusValue = (value: string): 'pending' | 'completed' | 'failed' | '' => (
  value === 'pending' || value === 'completed' || value === 'failed' ? value : ''
);

export const parseAuditScope = (value: string): AuditScopeValue => (
  value === 'single' || value === 'bulk' || value === 'all_dead_lettered' ? value : ''
);

export const buildAuditDateRange = (preset: AuditDateRangePreset): { since: string; until: string } | null => {
  if (!preset) {
    return null;
  }
  const windowMs = AUDIT_DATE_RANGE_PRESET_TO_MS[preset];
  const until = new Date();
  const since = new Date(until.getTime() - windowMs);
  return {
    since: since.toISOString(),
    until: until.toISOString()
  };
};
