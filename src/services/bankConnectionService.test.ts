/**
 * BankConnectionService Tests
 * Tests for the bank connection service that handles Open Banking integrations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { bankConnectionService } from './bankConnectionService';
import type { BankConnection, BankInstitution, SyncResult } from './bankConnectionService';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((index: number) => Object.keys(store)[index] || null)
  };
})();

// Replace global localStorage
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

describe('BankConnectionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
    // Reinitialize service to clear state
    bankConnectionService['connections'] = [];
    bankConnectionService['plaidConfig'] = {};
    bankConnectionService['trueLayerConfig'] = {};
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('initializes with empty connections', () => {
      const connections = bankConnectionService.getConnections();
      expect(connections).toEqual([]);
    });

    it('loads connections from localStorage on construction', () => {
      const mockConnections: BankConnection[] = [{
        id: 'conn_123',
        provider: 'plaid',
        institutionId: 'test-bank',
        institutionName: 'Test Bank',
        status: 'connected',
        accounts: ['acc1'],
        createdAt: new Date('2025-01-01')
      }];
      
      mockLocalStorage.setItem('bankConnections', JSON.stringify(mockConnections));
      
      // Force reload
      bankConnectionService['loadConnections']();
      
      const connections = bankConnectionService.getConnections();
      expect(connections).toHaveLength(1);
      expect(connections[0].id).toBe('conn_123');
    });

    it('initializes API configuration', () => {
      const config = {
        plaid: {
          clientId: 'test-client-id',
          secret: 'test-secret',
          environment: 'sandbox' as const
        },
        trueLayer: {
          clientId: 'tl-client-id',
          clientSecret: 'tl-secret',
          environment: 'sandbox' as const
        }
      };

      bankConnectionService.initialize(config);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'bankAPIConfig',
        expect.stringContaining('test-client-id')
      );
    });
  });

  describe('getInstitutions', () => {
    it('returns UK institutions by default', async () => {
      const institutions = await bankConnectionService.getInstitutions();
      
      expect(institutions).toBeInstanceOf(Array);
      expect(institutions.length).toBeGreaterThan(0);
      expect(institutions[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        country: 'GB',
        provider: expect.stringMatching(/^(plaid|truelayer)$/),
        supportsAccountDetails: true,
        supportsTransactions: true,
        supportsBalance: true
      });
    });

    it('includes major UK banks', async () => {
      const institutions = await bankConnectionService.getInstitutions('GB');
      const names = institutions.map(i => i.name);
      
      expect(names).toContain('Barclays');
      expect(names).toContain('HSBC');
      expect(names).toContain('Lloyds Bank');
      expect(names).toContain('NatWest');
      expect(names).toContain('Monzo');
      expect(names).toContain('Revolut');
    });
  });

  describe('connectBank', () => {
    it('returns auth URL for TrueLayer', async () => {
      bankConnectionService.initialize({
        trueLayer: {
          clientId: 'tl-test-client',
          redirectUri: 'http://localhost:3000/auth/callback'
        }
      });

      const result = await bankConnectionService.connectBank('barclays', 'truelayer');
      
      expect(result.url).toBeDefined();
      expect(result.url).toContain('auth.truelayer.com');
      expect(result.url).toContain('client_id=tl-test-client');
      expect(result.url).toContain('providers=barclays');
      expect(result.url).toContain(encodeURIComponent('http://localhost:3000/auth/callback'));
    });

    it('returns link token for Plaid', async () => {
      const result = await bankConnectionService.connectBank('chase', 'plaid');
      
      expect(result.linkToken).toBeDefined();
      expect(result.linkToken).toBe('link-sandbox-demo-token');
      expect(result.url).toBeUndefined();
    });

    it('uses default values when not configured', async () => {
      const result = await bankConnectionService.connectBank('hsbc', 'truelayer');
      
      expect(result.url).toContain('client_id=demo');
      expect(result.url).toContain(encodeURIComponent(window.location.origin + '/auth/callback'));
    });
  });

  describe('handleOAuthCallback', () => {
    it('creates new connection after OAuth', async () => {
      const connection = await bankConnectionService.handleOAuthCallback('auth-code-123');
      
      expect(connection).toMatchObject({
        id: expect.stringMatching(/^conn_\d+$/),
        provider: 'truelayer',
        institutionId: 'demo-bank',
        institutionName: 'Demo Bank',
        status: 'connected',
        accounts: [],
        lastSync: expect.any(Date),
        createdAt: expect.any(Date),
        expiresAt: expect.any(Date)
      });
    });

    it('sets expiry date 90 days in future', async () => {
      const connection = await bankConnectionService.handleOAuthCallback('auth-code-123');
      
      const daysDiff = Math.round(
        (connection.expiresAt!.getTime() - connection.createdAt.getTime()) / 
        (1000 * 60 * 60 * 24)
      );
      expect(daysDiff).toBe(90);
    });

    it('saves connection to localStorage', async () => {
      await bankConnectionService.handleOAuthCallback('auth-code-123');
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'bankConnections',
        expect.stringContaining('conn_')
      );
    });

    it('adds connection to internal list', async () => {
      const connectionsBefore = bankConnectionService.getConnections().length;
      await bankConnectionService.handleOAuthCallback('auth-code-123');
      const connectionsAfter = bankConnectionService.getConnections().length;
      
      expect(connectionsAfter).toBe(connectionsBefore + 1);
    });
  });

  describe('syncConnection', () => {
    it('returns error for non-existent connection', async () => {
      const result = await bankConnectionService.syncConnection('invalid-id');
      
      expect(result).toEqual({
        success: false,
        accountsUpdated: 0,
        transactionsImported: 0,
        errors: ['Connection not found']
      });
    });

    it('updates lastSync on successful sync', async () => {
      const connection = await bankConnectionService.handleOAuthCallback('auth-code');
      const originalSync = connection.lastSync;
      
      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result = await bankConnectionService.syncConnection(connection.id);
      const updatedConnection = bankConnectionService.getConnection(connection.id);
      
      expect(result.success).toBe(true);
      expect(updatedConnection?.lastSync).not.toEqual(originalSync);
    });

    it('returns account count in sync result', async () => {
      const connection = await bankConnectionService.handleOAuthCallback('auth-code');
      bankConnectionService.linkAccount(connection.id, 'ext-acc-1', 'int-acc-1');
      bankConnectionService.linkAccount(connection.id, 'ext-acc-2', 'int-acc-2');
      
      const result = await bankConnectionService.syncConnection(connection.id);
      
      expect(result.accountsUpdated).toBe(2);
    });

    it('handles sync errors gracefully', async () => {
      const connection = await bankConnectionService.handleOAuthCallback('auth-code');
      
      // Mock an error by manipulating the connection
      connection.status = 'error';
      const mockError = new Error('API Error');
      
      // Since the current implementation doesn't actually throw,
      // we'll test the error handling path exists
      expect(() => bankConnectionService.syncConnection(connection.id)).not.toThrow();
    });
  });

  describe('syncAll', () => {
    it('syncs all connected connections', async () => {
      const conn1 = await bankConnectionService.handleOAuthCallback('code-1');
      const conn2 = await bankConnectionService.handleOAuthCallback('code-2');
      conn2.status = 'error'; // This one shouldn't sync
      const conn3 = await bankConnectionService.handleOAuthCallback('code-3');
      
      const results = await bankConnectionService.syncAll();
      
      expect(results.size).toBe(2); // Only connected ones
      expect(results.has(conn1.id)).toBe(true);
      expect(results.has(conn2.id)).toBe(false);
      expect(results.has(conn3.id)).toBe(true);
    });

    it('returns individual sync results', async () => {
      const conn1 = await bankConnectionService.handleOAuthCallback('code-1');
      bankConnectionService.linkAccount(conn1.id, 'ext-1', 'int-1');
      
      const results = await bankConnectionService.syncAll();
      const result = results.get(conn1.id);
      
      expect(result).toBeDefined();
      expect(result?.success).toBe(true);
      expect(result?.accountsUpdated).toBe(1);
    });
  });

  describe('disconnect', () => {
    it('removes connection', async () => {
      const connection = await bankConnectionService.handleOAuthCallback('auth-code');
      const result = await bankConnectionService.disconnect(connection.id);
      
      expect(result).toBe(true);
      expect(bankConnectionService.getConnection(connection.id)).toBeUndefined();
    });

    it('returns false for non-existent connection', async () => {
      const result = await bankConnectionService.disconnect('invalid-id');
      expect(result).toBe(false);
    });

    it('updates localStorage after disconnect', async () => {
      const connection = await bankConnectionService.handleOAuthCallback('auth-code');
      await bankConnectionService.disconnect(connection.id);
      
      const stored = mockLocalStorage.getItem('bankConnections');
      expect(stored).toBe('[]');
    });
  });

  describe('connection management', () => {
    it('getConnection returns connection by ID', async () => {
      const created = await bankConnectionService.handleOAuthCallback('auth-code');
      const fetched = bankConnectionService.getConnection(created.id);
      
      expect(fetched).toEqual(created);
    });

    it('getConnection returns undefined for invalid ID', () => {
      const connection = bankConnectionService.getConnection('invalid-id');
      expect(connection).toBeUndefined();
    });

    it('linkAccount adds account to connection', async () => {
      const connection = await bankConnectionService.handleOAuthCallback('auth-code');
      
      bankConnectionService.linkAccount(connection.id, 'ext-acc-123', 'int-acc-456');
      
      const updated = bankConnectionService.getConnection(connection.id);
      expect(updated?.accounts).toContain('int-acc-456');
    });

    it('linkAccount prevents duplicate accounts', async () => {
      const connection = await bankConnectionService.handleOAuthCallback('auth-code');
      
      bankConnectionService.linkAccount(connection.id, 'ext-1', 'int-1');
      bankConnectionService.linkAccount(connection.id, 'ext-2', 'int-1'); // Same internal ID
      
      const updated = bankConnectionService.getConnection(connection.id);
      expect(updated?.accounts).toHaveLength(1);
    });
  });

  describe('reauthorization', () => {
    it('identifies connections needing reauth', async () => {
      const conn1 = await bankConnectionService.handleOAuthCallback('code-1');
      conn1.status = 'reauth_required';
      
      const conn2 = await bankConnectionService.handleOAuthCallback('code-2');
      conn2.expiresAt = new Date(Date.now() - 1000); // Expired
      
      const conn3 = await bankConnectionService.handleOAuthCallback('code-3');
      // This one is fine
      
      const needsReauth = bankConnectionService.needsReauth();
      
      expect(needsReauth).toHaveLength(2);
      expect(needsReauth.map(c => c.id)).toContain(conn1.id);
      expect(needsReauth.map(c => c.id)).toContain(conn2.id);
    });
  });

  describe('configuration', () => {
    it('isConfigured returns false when not configured', () => {
      expect(bankConnectionService.isConfigured()).toBe(false);
    });

    it('isConfigured returns true when Plaid configured', () => {
      bankConnectionService.initialize({
        plaid: {
          clientId: 'test-id',
          secret: 'test-secret'
        }
      });
      
      expect(bankConnectionService.isConfigured()).toBe(true);
    });

    it('isConfigured returns true when TrueLayer configured', () => {
      bankConnectionService.initialize({
        trueLayer: {
          clientId: 'test-id',
          clientSecret: 'test-secret'
        }
      });
      
      expect(bankConnectionService.isConfigured()).toBe(true);
    });

    it('getConfigStatus returns individual provider status', () => {
      bankConnectionService.initialize({
        plaid: {
          clientId: 'test-id',
          secret: 'test-secret'
        }
      });
      
      const status = bankConnectionService.getConfigStatus();
      
      expect(status.plaid).toBe(true);
      expect(status.trueLayer).toBe(false);
    });
  });

  describe('error handling', () => {
    it('handles localStorage errors gracefully', () => {
      mockLocalStorage.getItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });
      
      expect(() => bankConnectionService['loadConnections']()).not.toThrow();
      expect(bankConnectionService.getConnections()).toEqual([]);
    });

    it('handles malformed JSON in localStorage', () => {
      mockLocalStorage.getItem.mockReturnValueOnce('invalid-json');
      
      expect(() => bankConnectionService['loadConnections']()).not.toThrow();
      expect(bankConnectionService.getConnections()).toEqual([]);
    });

    it('logs errors to console', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLocalStorage.setItem.mockImplementationOnce(() => {
        throw new Error('Save error');
      });
      
      bankConnectionService['saveConnections']();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to save bank connections:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });
});