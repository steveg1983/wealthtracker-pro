import {
  createUserIdService,
  type UserIdService,
  type ClerkUserId,
  type DatabaseUserId,
  type SupabaseClientLike,
  UUID_REGEX,
  isDatabaseUuid,
} from '@wealthtracker/core';
import { lazyLogger as logger } from './serviceFactory';

type LoggerLike = Pick<typeof logger, 'warn' | 'error' | 'info' | 'debug'>;

const coreUserIdService = createUserIdService({ logger });

export const userIdService: UserIdService = coreUserIdService;

export async function resolveDatabaseUserId(userIdentifier: string): Promise<string | null> {
  return userIdService.getDatabaseUserId(userIdentifier);
}

export { UUID_REGEX, isDatabaseUuid };
export type { ClerkUserId, DatabaseUserId };

export const __testing = {
  resetState(): void {
    coreUserIdService.__testing.resetState();
  },
  mockLogger(loggerLike: LoggerLike | null): void {
    coreUserIdService.__testing.mockLogger(loggerLike);
  },
  setSupabaseClient(client: SupabaseClientLike | null): void {
    coreUserIdService.__testing.setSupabaseClient(client);
  },
};
