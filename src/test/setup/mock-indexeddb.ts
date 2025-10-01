/**
 * Mock IndexedDB for testing
 */

import { vi } from 'vitest';

type MockRequest<T> = {
  result: T;
  onsuccess: ((event: { target: { result: T } }) => void) | null;
  onerror: ((event: { target: { error: Error } }) => void) | null;
  onupgradeneeded?: ((event: { target: { result: T } }) => void) | null;
};

const createAsyncRequest = <T>(result: T): MockRequest<T> => {
  const request: MockRequest<T> = {
    result,
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
  };

  queueMicrotask(() => {
    request.onupgradeneeded?.({ target: { result } });
    request.onsuccess?.({ target: { result } });
  });

  return request;
};

const createStore = () => {
  const createOperation = <R>(value: R) => (): MockRequest<R> => createAsyncRequest(value);

  return {
    get: vi.fn(createOperation<unknown>(null)),
    put: vi.fn(createOperation<void>(undefined)),
    delete: vi.fn(createOperation<void>(undefined)),
    clear: vi.fn(createOperation<void>(undefined)),
    getAll: vi.fn(createOperation<unknown[]>([])),
    createIndex: vi.fn(),
    index: vi.fn(),
  } as unknown as IDBObjectStore;
};

const createTransaction = () => ({
  objectStore: vi.fn(() => createStore()),
}) as unknown as IDBTransaction;

const createDatabase = () => ({
  transaction: vi.fn(() => createTransaction()),
  createObjectStore: vi.fn(() => createStore()),
  deleteObjectStore: vi.fn(),
  close: vi.fn(),
  objectStoreNames: {
    contains: vi.fn(() => false),
    length: 0,
    item: vi.fn(() => null),
  },
}) as unknown as IDBDatabase;

global.indexedDB = {
  open: vi.fn(() => createAsyncRequest(createDatabase())),
  deleteDatabase: vi.fn(() => createAsyncRequest(undefined)),
} as unknown as IDBFactory;

export {};
