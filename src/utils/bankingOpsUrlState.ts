export type BankingAuditStatus = 'pending' | 'completed' | 'failed';
export type BankingAuditScope = 'single' | 'bulk' | 'all_dead_lettered';
export type BankingAuditDateRangePreset = '24h' | '7d' | '30d';

const BANKING_MODAL_KEY = 'bankingModal';
const BANKING_OPS_ONLY_ABOVE_THRESHOLD_KEY = 'bankingOpsOnlyAboveThreshold';
const BANKING_OPS_EVENT_TYPE_KEY = 'bankingOpsEventType';
const BANKING_OPS_EVENT_PREFIX_KEY = 'bankingOpsEventPrefix';
const BANKING_AUDIT_OPEN_KEY = 'bankingAuditOpen';
const BANKING_AUDIT_STATUS_KEY = 'bankingAuditStatus';
const BANKING_AUDIT_SCOPE_KEY = 'bankingAuditScope';
const BANKING_AUDIT_DATE_RANGE_KEY = 'bankingAuditRange';

const AUDIT_STATUS_VALUES = new Set<BankingAuditStatus>(['pending', 'completed', 'failed']);
const AUDIT_SCOPE_VALUES = new Set<BankingAuditScope>(['single', 'bulk', 'all_dead_lettered']);
const AUDIT_DATE_RANGE_VALUES = new Set<BankingAuditDateRangePreset>(['24h', '7d', '30d']);

interface ParsedBankingOpsUrlState {
  modalOpen: boolean;
  onlyAboveThreshold: boolean;
  eventType?: string;
  eventTypePrefix?: string;
  auditOpen: boolean;
  auditStatus?: BankingAuditStatus;
  auditScope?: BankingAuditScope;
  auditDateRangePreset?: BankingAuditDateRangePreset;
}

export interface BankingOpsUrlStateUpdate {
  modalOpen?: boolean | null;
  onlyAboveThreshold?: boolean | null;
  eventType?: string | null;
  eventTypePrefix?: string | null;
  auditOpen?: boolean | null;
  auditStatus?: BankingAuditStatus | null;
  auditScope?: BankingAuditScope | null;
  auditDateRangePreset?: BankingAuditDateRangePreset | null;
}

const parseBooleanQuery = (value: string | null): boolean => value === '1' || value === 'true';

const parseAuditStatus = (value: string | null): BankingAuditStatus | undefined => (
  value && AUDIT_STATUS_VALUES.has(value as BankingAuditStatus)
    ? (value as BankingAuditStatus)
    : undefined
);

const parseAuditScope = (value: string | null): BankingAuditScope | undefined => (
  value && AUDIT_SCOPE_VALUES.has(value as BankingAuditScope)
    ? (value as BankingAuditScope)
    : undefined
);

const parseAuditDateRangePreset = (value: string | null): BankingAuditDateRangePreset | undefined => (
  value && AUDIT_DATE_RANGE_VALUES.has(value as BankingAuditDateRangePreset)
    ? (value as BankingAuditDateRangePreset)
    : undefined
);

const parseFilterValue = (value: string | null): string | undefined => {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.slice(0, 200);
};

const hasOwn = (object: object, property: string): boolean =>
  Object.prototype.hasOwnProperty.call(object, property);

export const parseBankingOpsUrlState = (search: string): ParsedBankingOpsUrlState => {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const eventType = parseFilterValue(params.get(BANKING_OPS_EVENT_TYPE_KEY));
  const eventTypePrefix = parseFilterValue(params.get(BANKING_OPS_EVENT_PREFIX_KEY));
  const auditStatus = parseAuditStatus(params.get(BANKING_AUDIT_STATUS_KEY));
  const auditScope = parseAuditScope(params.get(BANKING_AUDIT_SCOPE_KEY));
  const auditDateRangePreset = parseAuditDateRangePreset(params.get(BANKING_AUDIT_DATE_RANGE_KEY));
  const onlyAboveThreshold = parseBooleanQuery(params.get(BANKING_OPS_ONLY_ABOVE_THRESHOLD_KEY));

  const hasAuditFilter = Boolean(auditStatus || auditScope || auditDateRangePreset);
  const hasOpsFilter = Boolean(eventType || eventTypePrefix || onlyAboveThreshold);
  const auditOpen = parseBooleanQuery(params.get(BANKING_AUDIT_OPEN_KEY)) || hasAuditFilter;
  const modalOpen = parseBooleanQuery(params.get(BANKING_MODAL_KEY)) || auditOpen || hasOpsFilter;

  return {
    modalOpen,
    onlyAboveThreshold,
    eventType,
    eventTypePrefix,
    auditOpen,
    auditStatus,
    auditScope,
    auditDateRangePreset
  };
};

export const withBankingOpsUrlState = (search: string, update: BankingOpsUrlStateUpdate): string => {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);

  if (hasOwn(update, 'modalOpen')) {
    if (update.modalOpen) {
      params.set(BANKING_MODAL_KEY, '1');
    } else {
      params.delete(BANKING_MODAL_KEY);
      params.delete(BANKING_OPS_ONLY_ABOVE_THRESHOLD_KEY);
      params.delete(BANKING_OPS_EVENT_TYPE_KEY);
      params.delete(BANKING_OPS_EVENT_PREFIX_KEY);
      params.delete(BANKING_AUDIT_OPEN_KEY);
      params.delete(BANKING_AUDIT_STATUS_KEY);
      params.delete(BANKING_AUDIT_SCOPE_KEY);
      params.delete(BANKING_AUDIT_DATE_RANGE_KEY);
    }
  }

  if (hasOwn(update, 'onlyAboveThreshold')) {
    if (update.onlyAboveThreshold) {
      params.set(BANKING_OPS_ONLY_ABOVE_THRESHOLD_KEY, '1');
    } else {
      params.delete(BANKING_OPS_ONLY_ABOVE_THRESHOLD_KEY);
    }
  }

  if (hasOwn(update, 'eventType')) {
    if (update.eventType && update.eventType.trim()) {
      params.set(BANKING_OPS_EVENT_TYPE_KEY, update.eventType.trim());
      params.delete(BANKING_OPS_EVENT_PREFIX_KEY);
    } else {
      params.delete(BANKING_OPS_EVENT_TYPE_KEY);
    }
  }

  if (hasOwn(update, 'eventTypePrefix')) {
    if (update.eventTypePrefix && update.eventTypePrefix.trim()) {
      params.set(BANKING_OPS_EVENT_PREFIX_KEY, update.eventTypePrefix.trim());
      params.delete(BANKING_OPS_EVENT_TYPE_KEY);
    } else {
      params.delete(BANKING_OPS_EVENT_PREFIX_KEY);
    }
  }

  if (hasOwn(update, 'auditOpen')) {
    if (update.auditOpen) {
      params.set(BANKING_AUDIT_OPEN_KEY, '1');
    } else {
      params.delete(BANKING_AUDIT_OPEN_KEY);
      params.delete(BANKING_AUDIT_STATUS_KEY);
      params.delete(BANKING_AUDIT_SCOPE_KEY);
      params.delete(BANKING_AUDIT_DATE_RANGE_KEY);
    }
  }

  if (hasOwn(update, 'auditStatus')) {
    if (update.auditStatus) {
      params.set(BANKING_AUDIT_STATUS_KEY, update.auditStatus);
    } else {
      params.delete(BANKING_AUDIT_STATUS_KEY);
    }
  }

  if (hasOwn(update, 'auditScope')) {
    if (update.auditScope) {
      params.set(BANKING_AUDIT_SCOPE_KEY, update.auditScope);
    } else {
      params.delete(BANKING_AUDIT_SCOPE_KEY);
    }
  }

  if (hasOwn(update, 'auditDateRangePreset')) {
    if (update.auditDateRangePreset) {
      params.set(BANKING_AUDIT_DATE_RANGE_KEY, update.auditDateRangePreset);
    } else {
      params.delete(BANKING_AUDIT_DATE_RANGE_KEY);
    }
  }

  const query = params.toString();
  return query ? `?${query}` : '';
};

export const replaceBrowserSearch = (nextSearch: string): void => {
  if (typeof window === 'undefined') {
    return;
  }
  const currentSearch = window.location.search;
  if (currentSearch === nextSearch) {
    return;
  }
  const nextUrl = `${window.location.pathname}${nextSearch}${window.location.hash}`;
  window.history.replaceState(window.history.state, '', nextUrl);
};
