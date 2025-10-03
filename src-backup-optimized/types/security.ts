// Type definitions for security service

import type { JsonValue } from './common';

export interface AuditLogChanges {
  [key: string]: {
    old?: JsonValue;
    new?: JsonValue;
  };
}

export interface SavedAuditLog {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  changes?: AuditLogChanges;
  ipAddress?: string;
  userAgent?: string;
}

export type BiometricAvailabilityResult = Promise<boolean> | boolean;