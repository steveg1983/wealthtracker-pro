import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentService } from '../documentService';
import { indexedDBService } from '../indexedDBService';

vi.mock('../indexedDBService', () => {
  const db = {
    init: vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn().mockResolvedValue([]),
    getByIndex: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(undefined),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    storeBlob: vi.fn().mockResolvedValue(undefined),
    getBlob: vi.fn().mockResolvedValue(undefined),
    count: vi.fn().mockResolvedValue(0),
    cleanCache: vi.fn().mockResolvedValue(undefined),
    getStorageInfo: vi.fn().mockResolvedValue({ usage: 0, quota: 0 })
  };

  return {
    indexedDBService: db,
    migrateFromLocalStorage: vi.fn().mockResolvedValue(undefined)
  };
});

const createStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    })
  };
};

describe('DocumentService (deterministic)', () => {
  const logger = { error: vi.fn(), warn: vi.fn(), log: vi.fn() };
  const mockedDb = indexedDBService as unknown as Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    Object.values(mockedDb).forEach((fn) => {
      if (typeof fn?.mockReset === 'function') {
        fn.mockReset();
      }
    });
    logger.error.mockReset();
    logger.warn.mockReset();
    logger.log.mockReset();
  });

  it('falls back to local storage when IndexedDB load fails', async () => {
    const storage = createStorage();
    const storedDoc = {
      id: 'doc-1',
      type: 'receipt' as const,
      fileName: 'receipt.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      uploadDate: '2025-01-01T00:00:00.000Z',
      tags: [],
      fullUrl: 'doc-1'
    };
    storage.getItem.mockImplementation((key: string) =>
      key === 'wealthtracker_documents' ? JSON.stringify([storedDoc]) : null
    );
    mockedDb.getAll.mockRejectedValueOnce(new Error('db unavailable'));

    const service = new DocumentService({
      storage,
      logger
    });

    const docs = await service.getDocuments();
    expect(docs).toHaveLength(1);
    expect(docs[0].id).toBe('doc-1');
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to load documents from IndexedDB:',
      expect.any(Error)
    );
  });

  it('cleans up old documents using injected clock', async () => {
    const storage = createStorage();
    const oldDoc = {
      id: 'old',
      type: 'receipt' as const,
      fileName: 'old.pdf',
      fileSize: 100,
      mimeType: 'application/pdf',
      uploadDate: new Date('2024-01-01T00:00:00.000Z'),
      tags: [],
      notes: '',
      fullUrl: 'old'
    };
    const recentDoc = {
      ...oldDoc,
      id: 'recent',
      uploadDate: new Date('2025-01-15T00:00:00.000Z')
    };
    mockedDb.getAll.mockResolvedValueOnce([oldDoc as any, recentDoc as any]);

    const service = new DocumentService({
      storage,
      logger,
      now: () => new Date('2025-02-01T00:00:00.000Z')
    });

    const removed = await service.cleanupOldDocuments(30);
    expect(removed).toBe(1);
    expect(mockedDb.delete).toHaveBeenCalledWith('documents', 'old');
    expect(mockedDb.cleanCache).toHaveBeenCalled();
  });
});
