/**
 * Serialize data for Redux storage by converting Date objects to ISO strings
 */

export function serializeForRedux<T>(data: T): T extends Date ? string : T {
  if (data instanceof Date) {
    return data.toISOString() as unknown as T extends Date ? string : T;
  }

  if (Array.isArray(data)) {
    return data.map(serializeForRedux) as T;
  }

  if (data !== null && typeof data === 'object') {
    const serialized: Record<string, unknown> = {};
    for (const key in data) {
      if (Object.hasOwn(data, key)) {
        serialized[key] = serializeForRedux(data[key]);
      }
    }
    return serialized as unknown as T;
  }

  return data;
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
