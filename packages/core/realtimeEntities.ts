import type { RealtimeCallback, RealtimeService, RealtimeLogger } from './realtime';
import { createRealtimeService } from './realtime';
import type { UserIdService } from './userIdService';
import { userIdService as defaultUserIdService } from './userIdService';

export interface EntityRealtimeDefinition<Payload> {
  table: string;
  schema?: string;
  channel?: (databaseUserId: string) => string;
  filter?: string | ((databaseUserId: string) => string);
  /**
   * @internal helper for carrying payload typing through structural typing.
   */
  readonly __payloadType?: (payload: Payload) => Payload;
}

type EntityDefinitionsRecord = Record<string, EntityRealtimeDefinition<any>>;

export type EntityPayload<
  Definitions extends EntityDefinitionsRecord,
  Key extends keyof Definitions,
> = Definitions[Key] extends EntityRealtimeDefinition<infer Payload> ? Payload : never;

export interface CreateUserEntityRealtimeServiceOptions<Definitions extends EntityDefinitionsRecord> {
  definitions: Definitions;
  userIdService?: UserIdService;
  realtimeService?: RealtimeService;
  logger?: RealtimeLogger;
}

export type UserEntityRealtimeService<Definitions extends EntityDefinitionsRecord> = RealtimeService & {
  subscribeEntity<Key extends keyof Definitions>(
    entity: Key,
    userIdentifier: string,
    callback: RealtimeCallback<EntityPayload<Definitions, Key>>,
  ): Promise<string | null>;
};

const DEFAULT_SCHEMA = 'public';

const resolveFilter = (
  databaseUserId: string,
  filter: string | ((databaseUserId: string) => string) | undefined,
): string => {
  if (!filter) {
    return `user_id=eq.${databaseUserId}`;
  }

  return typeof filter === 'function' ? filter(databaseUserId) : filter;
};

export function createUserEntityRealtimeService<
  Definitions extends EntityDefinitionsRecord,
>(options: CreateUserEntityRealtimeServiceOptions<Definitions>): UserEntityRealtimeService<Definitions> {
  const userService = options.userIdService ?? defaultUserIdService;
  const realtime =
    options.realtimeService ??
    createRealtimeService(options.logger ? { logger: options.logger } : {});
  const definitions = options.definitions;

  const subscribeEntity: UserEntityRealtimeService<Definitions>['subscribeEntity'] = async (
    entity,
    userIdentifier,
    callback,
  ) => {
    const definition = definitions[entity];
    if (!definition) {
      throw new Error(`Unknown realtime entity "${String(entity)}"`);
    }

    const databaseUserId = await userService.getDatabaseUserId(userIdentifier);
    if (!databaseUserId) {
      return null;
    }

    const subscriptionKey = `${definition.table}:${databaseUserId}`;
    const channelName = definition.channel
      ? definition.channel(databaseUserId)
      : `${definition.table}_${databaseUserId}`;

    return realtime.subscribe({
      key: subscriptionKey,
      channel: channelName,
      schema: definition.schema ?? DEFAULT_SCHEMA,
      table: definition.table,
      filter: resolveFilter(databaseUserId, definition.filter),
      onEvent: callback,
    });
  };

  return {
    ...realtime,
    subscribeEntity,
  };
}
