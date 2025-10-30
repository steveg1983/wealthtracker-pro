// Type definitions for storage services

import type { JsonValue } from './common';

export interface StorageOptions {
  encrypted?: boolean;
  expiryDays?: number;
  compress?: boolean;
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

export interface BulkStorageItem {
  key: string;
  value: StoredData<JsonValue>;
}

export interface StorageEstimate {
  usage: number;
  quota: number;
  percentUsed: number;
}

export type StorageData = JsonValue;

export type ExportedData = Record<string, JsonValue>;
