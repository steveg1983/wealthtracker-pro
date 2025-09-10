/**
 * Serialize data for Redux storage by converting Date objects to ISO strings
 */

type SerializedType<T> = T extends Date 
  ? string 
  : T extends Array<infer U>
  ? Array<SerializedType<U>>
  : T extends object
  ? { [K in keyof T]: SerializedType<T[K]> }
  : T;

export function serializeForRedux<T>(data: T): SerializedType<T> {
  if (data instanceof Date) {
    return data.toISOString() as SerializedType<T>;
  }

  if (Array.isArray(data)) {
    return data.map(item => serializeForRedux(item)) as SerializedType<T>;
  }

  if (data !== null && typeof data === 'object') {
    const serialized: Record<string, unknown> = {};
    for (const key in data) {
      if (Object.hasOwn(data, key)) {
        serialized[key] = serializeForRedux((data as Record<string, unknown>)[key]);
      }
    }
    return serialized as SerializedType<T>;
  }

  return data as SerializedType<T>;
}

/**
 * Deserialize data from Redux by converting ISO strings back to Date objects
 * for specific date fields
 */
export function deserializeFromRedux<T>(data: T, dateFields: string[] = []): T {
  if (typeof data === 'string' && dateFields.length === 0) {
    // If it's a string and might be a date, try to parse it
    const date = new Date(data);
    if (!isNaN(date.getTime()) && data.includes('T')) {
      return date as T;
    }
  }

  if (Array.isArray(data)) {
    return data.map(item => deserializeFromRedux(item, dateFields)) as T;
  }

  if (data !== null && typeof data === 'object') {
    const input = data as unknown as Record<string, unknown>;
    const deserialized: Record<string, unknown> = {};
    for (const key in input) {
      if (Object.hasOwn(input, key)) {
        const value = input[key];
        if (dateFields.includes(key) && typeof value === 'string') {
          deserialized[key] = new Date(value);
        } else {
          deserialized[key] = deserializeFromRedux(value as unknown, dateFields);
        }
      }
    }
    return deserialized as unknown as T;
  }

  return data;
}

// Common date field names in the app
export const COMMON_DATE_FIELDS = [
  'date',
  'createdAt',
  'updatedAt',
  'lastUpdated',
  'targetDate',
  'lastProcessed',
  'timestamp'
];
