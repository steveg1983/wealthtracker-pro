import type { EntityType, SyncData } from '../types/sync-types';

export type ConflictDataShape = 'object' | 'array' | 'primitive';

export type ConflictRawValue<T extends EntityType = EntityType> =
  | SyncData<T>
  | Record<string, unknown>
  | unknown[]
  | string
  | number
  | boolean
  | null
  | undefined;

export interface NormalizedConflictData<T extends EntityType = EntityType> {
  normalized: Record<string, unknown>;
  raw: ConflictRawValue<T>;
  shape: ConflictDataShape;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toArrayKey = (index: number): string => `[${index}]`;

const parseArrayKey = (key: string): number | null => {
  const trimmed = key.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const numericPortion = trimmed.slice(1, -1);
    const parsed = Number.parseInt(numericPortion, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  const fallbackParsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(fallbackParsed) ? null : fallbackParsed;
};

export const normalizeConflictValue = <T extends EntityType = EntityType>(
  value: ConflictRawValue<T>
): NormalizedConflictData<T> => {
  if (Array.isArray(value)) {
    const normalized: Record<string, unknown> = {};
    value.forEach((item, index) => {
      normalized[toArrayKey(index)] = item;
    });
    return {
      normalized,
      raw: value,
      shape: 'array'
    };
  }

  if (isPlainObject(value)) {
    return {
      normalized: { ...value },
      raw: value,
      shape: 'object'
    };
  }

  if (value === null || value === undefined) {
    return {
      normalized: {},
      raw: value,
      shape: 'primitive'
    };
  }

  return {
    normalized: { value },
    raw: value,
    shape: 'primitive'
  };
};

export const denormalizeConflictValue = <T extends EntityType = EntityType>(
  normalized: Record<string, unknown>,
  shape: ConflictDataShape,
  fallback?: ConflictRawValue<T>
): ConflictRawValue<T> => {
  if (shape === 'array') {
    const items = Object.entries(normalized)
      .map(([key, item]) => {
        const index = parseArrayKey(key);
        return index === null ? null : { index, item };
      })
      .filter((entry): entry is { index: number; item: unknown } => entry !== null)
      .sort((a, b) => a.index - b.index)
      .map(({ item }) => item);

    if (items.length > 0) {
      return items;
    }

    if (Array.isArray(fallback)) {
      return fallback;
    }

    return [];
  }

  if (shape === 'object') {
    return normalized;
  }

  if ('value' in normalized) {
    return normalized.value as ConflictRawValue<T>;
  }

  return fallback ?? null;
};
