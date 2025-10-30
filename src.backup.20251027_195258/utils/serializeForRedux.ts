/**
 * Serialize data for Redux storage by converting Date objects to ISO strings
 */
type SerializedForRedux<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? SerializedForRedux<U>[]
    : T extends Record<string, unknown>
      ? { [K in keyof T]: SerializedForRedux<T[K]> }
      : T;

export function serializeForRedux<T>(data: T): SerializedForRedux<T> {
  if (data instanceof Date) {
    return data.toISOString() as SerializedForRedux<T>;
  }

  if (Array.isArray(data)) {
    return data.map((item) => serializeForRedux(item)) as SerializedForRedux<T>;
  }

  if (data !== null && typeof data === 'object') {
    const source = data as Record<string, unknown>;
    const serialized: Record<string, unknown> = {};
    for (const key of Object.keys(source)) {
      serialized[key] = serializeForRedux(source[key]);
    }
    return serialized as SerializedForRedux<T>;
  }

  return data as SerializedForRedux<T>;
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
    const deserialized: Record<string, unknown> = {};
    for (const key in data) {
      if (Object.hasOwn(data, key)) {
        if (dateFields.includes(key) && typeof data[key] === 'string') {
          deserialized[key] = new Date(data[key]);
        } else {
          deserialized[key] = deserializeFromRedux(data[key], dateFields);
        }
      }
    }
    return deserialized as T;
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
