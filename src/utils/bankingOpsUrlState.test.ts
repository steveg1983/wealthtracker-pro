import { describe, expect, it } from 'vitest';
import { parseBankingOpsUrlState, replaceBrowserSearch, withBankingOpsUrlState } from './bankingOpsUrlState';

describe('bankingOpsUrlState', () => {
  it('parses empty search as closed defaults', () => {
    const result = parseBankingOpsUrlState('');
    expect(result).toEqual({
      modalOpen: false,
      onlyAboveThreshold: false,
      eventType: undefined,
      eventTypePrefix: undefined,
      auditOpen: false,
      auditStatus: undefined,
      auditScope: undefined,
      auditDateRangePreset: undefined
    });
  });

  it('parses modal and audit filters from search', () => {
    const result = parseBankingOpsUrlState(
      '?bankingModal=1&bankingOpsOnlyAboveThreshold=1&bankingOpsEventPrefix=banking.truelayer.jwks_circuit_&bankingAuditOpen=1&bankingAuditStatus=failed&bankingAuditScope=bulk&bankingAuditRange=7d'
    );
    expect(result).toEqual({
      modalOpen: true,
      onlyAboveThreshold: true,
      eventType: undefined,
      eventTypePrefix: 'banking.truelayer.jwks_circuit_',
      auditOpen: true,
      auditStatus: 'failed',
      auditScope: 'bulk',
      auditDateRangePreset: '7d'
    });
  });

  it('opens modal when ops event filters are provided without explicit bankingModal', () => {
    const result = parseBankingOpsUrlState('?bankingOpsEventPrefix=banking.truelayer.jwks_circuit_');
    expect(result).toEqual({
      modalOpen: true,
      onlyAboveThreshold: false,
      eventType: undefined,
      eventTypePrefix: 'banking.truelayer.jwks_circuit_',
      auditOpen: false,
      auditStatus: undefined,
      auditScope: undefined,
      auditDateRangePreset: undefined
    });
  });

  it('adds and clears audit filter params while preserving unrelated query params', () => {
    const withAudit = withBankingOpsUrlState('?demo=true', {
      modalOpen: true,
      eventTypePrefix: 'banking.truelayer.jwks_circuit_',
      auditOpen: true,
      auditStatus: 'failed',
      auditScope: 'single',
      auditDateRangePreset: '24h'
    });
    const withAuditParams = new URLSearchParams(withAudit.slice(1));
    expect(withAuditParams.get('demo')).toBe('true');
    expect(withAuditParams.get('bankingModal')).toBe('1');
    expect(withAuditParams.get('bankingOpsEventPrefix')).toBe('banking.truelayer.jwks_circuit_');
    expect(withAuditParams.get('bankingAuditOpen')).toBe('1');
    expect(withAuditParams.get('bankingAuditStatus')).toBe('failed');
    expect(withAuditParams.get('bankingAuditScope')).toBe('single');
    expect(withAuditParams.get('bankingAuditRange')).toBe('24h');

    const clearedAudit = withBankingOpsUrlState(withAudit, {
      auditOpen: false
    });
    const clearedAuditParams = new URLSearchParams(clearedAudit.slice(1));
    expect(clearedAuditParams.get('demo')).toBe('true');
    expect(clearedAuditParams.get('bankingModal')).toBe('1');
    expect(clearedAuditParams.get('bankingAuditOpen')).toBeNull();
    expect(clearedAuditParams.get('bankingAuditStatus')).toBeNull();
    expect(clearedAuditParams.get('bankingAuditScope')).toBeNull();
    expect(clearedAuditParams.get('bankingAuditRange')).toBeNull();
    expect(clearedAuditParams.get('bankingOpsEventPrefix')).toBe('banking.truelayer.jwks_circuit_');

    const modalClosed = withBankingOpsUrlState(clearedAudit, {
      modalOpen: false
    });
    const modalClosedParams = new URLSearchParams(modalClosed.slice(1));
    expect(modalClosedParams.get('demo')).toBe('true');
    expect(modalClosedParams.get('bankingModal')).toBeNull();
    expect(modalClosedParams.get('bankingOpsEventPrefix')).toBeNull();
  });

  it('replaceBrowserSearch updates the URL search segment', () => {
    window.history.replaceState(window.history.state, '', '/settings/data?demo=true');
    replaceBrowserSearch('?demo=true&bankingModal=1');
    expect(window.location.search).toBe('?demo=true&bankingModal=1');
  });
});
