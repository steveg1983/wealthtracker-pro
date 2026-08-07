// Type definitions for storage services

import type { JsonValue } from './common';

export interface StorageOptions {
  encrypted?: boolean;
  expiryDays?: number;
}

export interface StoredData<T> extends Record<string, unknown> {
  data: T | string;
  timestamp: number;
  expiry?: number;
  encrypted: boolean;
  compressed?: boolean;
}

export interface StorageItem<T = JsonValue> {
  key: string;
  value: T;
  options?: StorageOptions;
}

/**
 * `StoredData<unknown>` rather than `StoredData<JsonValue>`: the value has
 * already been through `encrypt` (a string) or is on its way to structured
 * clone, so narrowing it here bought nothing except a cast at every call site.
 */
export interface BulkStorageItem {
  key: string;
  value: StoredData<unknown>;
}

export interface StorageEstimate {
  usage: number;
  quota: number;
  percentUsed: number;
}

export type StorageData = JsonValue;

export type ExportedData = Record<string, JsonValue>;
