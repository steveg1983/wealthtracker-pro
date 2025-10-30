import {
  createRealtimeService,
  createUserEntityRealtimeService,
  type ConnectionState,
  type RealtimeCallback,
  type RealtimeEvent,
  type EntityRealtimeDefinition,
} from '@wealthtracker/core';
import { logger } from './loggingService';
import { userIdService } from './userIdService';
import type { Account, Transaction, Budget, Goal } from '../types';

const realtimeLogger = {
  debug: (message: string, data?: unknown) => logger.debug(message, data, 'RealtimeService'),
  info: (message: string, data?: unknown) => logger.info(message, data, 'RealtimeService'),
  warn: (message: string, data?: unknown) => logger.warn(message, data, 'RealtimeService'),
  error: (message: string, error?: unknown) => logger.error(message, error, 'RealtimeService'),
};

const baseRealtimeService = createRealtimeService({
  logger: realtimeLogger,
});

const entityDefinitions = {
  accounts: { table: 'accounts' },
  transactions: { table: 'transactions' },
  budgets: { table: 'budgets' },
  goals: { table: 'goals' },
} satisfies {
  accounts: EntityRealtimeDefinition<Account>;
  transactions: EntityRealtimeDefinition<Transaction>;
  budgets: EntityRealtimeDefinition<Budget>;
  goals: EntityRealtimeDefinition<Goal>;
};

const entityRealtimeService = createUserEntityRealtimeService<typeof entityDefinitions>({
  definitions: entityDefinitions,
  realtimeService: baseRealtimeService,
  userIdService,
});

const realtimeService = {
  ...entityRealtimeService,

  async subscribeToAccounts(
    clerkOrDbId: string,
    callback: RealtimeCallback<Account>,
    _options: { includeInitial?: boolean } = {},
  ): Promise<string | null> {
    return entityRealtimeService.subscribeEntity(
      'accounts',
      clerkOrDbId,
      ((event: RealtimeEvent<Account>) => {
        logger.debug('[RealtimeService] accounts realtime event', event);
        callback(event);
      }) as RealtimeCallback<unknown>,
    );
  },

  async subscribeToTransactions(
    clerkOrDbId: string,
    callback: RealtimeCallback<Transaction>,
    _options: { includeInitial?: boolean } = {},
  ): Promise<string | null> {
    return entityRealtimeService.subscribeEntity(
      'transactions',
      clerkOrDbId,
      ((event: RealtimeEvent<Transaction>) => {
        logger.debug('[RealtimeService] transactions realtime event', event);
        callback(event);
      }) as RealtimeCallback<unknown>,
    );
  },

  async subscribeToBudgets(
    clerkOrDbId: string,
    callback: RealtimeCallback<Budget>,
    _options: { includeInitial?: boolean } = {},
  ): Promise<string | null> {
    return entityRealtimeService.subscribeEntity(
      'budgets',
      clerkOrDbId,
      ((event: RealtimeEvent<Budget>) => {
        logger.debug('[RealtimeService] budgets realtime event', event);
        callback(event);
      }) as RealtimeCallback<unknown>,
    );
  },

  async subscribeToGoals(
    clerkOrDbId: string,
    callback: RealtimeCallback<Goal>,
    _options: { includeInitial?: boolean } = {},
  ): Promise<string | null> {
    return entityRealtimeService.subscribeEntity(
      'goals',
      clerkOrDbId,
      ((event: RealtimeEvent<Goal>) => {
        logger.debug('[RealtimeService] goals realtime event', event);
        callback(event);
      }) as RealtimeCallback<unknown>,
    );
  },
};

export type { ConnectionState, RealtimeCallback, RealtimeEvent };

export { realtimeService };
export default realtimeService;
