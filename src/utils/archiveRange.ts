export type ArchiveRange = '1m' | '3m' | '6m' | '12m' | 'all' | 'custom';

export const ARCHIVE_PRESETS: { value: ArchiveRange; label: string }[] = [
  { value: '1m', label: '1 month' },
  { value: '3m', label: '3 months' },
  { value: '6m', label: '6 months' },
  { value: '12m', label: '12 months' },
  { value: 'all', label: 'All' },
  { value: 'custom', label: 'Custom' }
];

const PRESET_MONTHS: Record<string, number> = { '1m': 1, '3m': 3, '6m': 6, '12m': 12 };

/**
 * Effective [from, to] date window for the register's "archive" selector.
 * Presets look back N months from `now`; 'custom' uses the given ISO dates;
 * 'all' is unbounded. `now` is injected so the calculation is testable.
 */
export function computeArchiveWindow(
  range: ArchiveRange,
  customFrom: string,
  customTo: string,
  now: Date = new Date()
): { from: Date | null; to: Date | null } {
  if (range === 'all') {
    return { from: null, to: null };
  }
  if (range === 'custom') {
    return {
      from: customFrom ? new Date(customFrom) : null,
      to: customTo ? new Date(customTo) : null
    };
  }
  const months = PRESET_MONTHS[range] ?? 0;
  const from = new Date(now);
  from.setMonth(from.getMonth() - months);
  return { from, to: null };
}
