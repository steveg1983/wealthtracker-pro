/**
 * Storage Service Interface
 * Defines the contract for storage operations
 */
export interface IStorageService {
  getItem<T>(key: string): T | null;
  setItem<T>(key: string, value: T): void;
  removeItem(key: string): void;
  clear(): void;
  hasItem(key: string): boolean;
}