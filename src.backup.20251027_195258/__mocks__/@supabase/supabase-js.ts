type QueryResult = { data: unknown; error: unknown };

const defaultResponse: QueryResult = { data: null, error: null };

type QueryBuilder = {
  select: () => QueryBuilder;
  insert: () => QueryBuilder;
  upsert: () => QueryBuilder;
  update: () => QueryBuilder;
  delete: () => QueryBuilder;
  eq: () => QueryBuilder;
  match: () => QueryBuilder;
  in: () => QueryBuilder;
  order: () => QueryBuilder;
  limit: () => QueryBuilder;
  range: () => QueryBuilder;
  filter: () => QueryBuilder;
  single: () => Promise<QueryResult>;
  maybeSingle: () => Promise<QueryResult>;
  returns: () => QueryBuilder;
  then: (resolve: (value: QueryResult) => unknown) => QueryBuilder;
  catch: () => QueryBuilder;
  finally: (handler: () => unknown) => QueryBuilder;
};

const createQueryBuilder = (): QueryBuilder => {
  const builder: QueryBuilder = {
    select: () => builder,
    insert: () => builder,
    upsert: () => builder,
    update: () => builder,
    delete: () => builder,
    eq: () => builder,
    match: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    range: () => builder,
    filter: () => builder,
    single: async () => defaultResponse,
    maybeSingle: async () => defaultResponse,
    returns: () => builder,
    then: (resolve) => {
      resolve(defaultResponse);
      return builder;
    },
    catch: () => builder,
    finally: (handler) => {
      handler();
      return builder;
    }
  };

  return builder;
};

type StorageBucket = {
  upload: () => Promise<QueryResult>;
  remove: () => Promise<QueryResult>;
  download: () => Promise<{ data: unknown; error: unknown }>;
  list: () => Promise<{ data: unknown[]; error: unknown }>;
  getPublicUrl: () => { data: { publicUrl: string } };
  update: () => Promise<QueryResult>;
};

const createStorageBucket = (): StorageBucket => ({
  upload: async () => defaultResponse,
  remove: async () => defaultResponse,
  download: async () => ({ data: null, error: null }),
  list: async () => ({ data: [], error: null }),
  getPublicUrl: () => ({ data: { publicUrl: '' } }),
  update: async () => defaultResponse
});

type ChannelApi = {
  on: () => ChannelApi;
  subscribe: () => Promise<{ data: { status: string }; error: null }>;
  unsubscribe: () => Promise<{ data: { status: string }; error: null }>;
};

export const createClient = () => {
  const channelApi: ChannelApi = {
    on: () => channelApi,
    subscribe: async () => ({ data: { status: 'SUBSCRIBED' }, error: null }),
    unsubscribe: async () => ({ data: { status: 'UNSUBSCRIBED' }, error: null })
  };

  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      signInWithPassword: async () => defaultResponse,
      signOut: async () => ({ error: null })
    },
    channel: () => channelApi,
    from: () => createQueryBuilder(),
    rpc: async () => defaultResponse,
    storage: {
      from: () => createStorageBucket()
    }
  };
};

export type SupabaseClient = ReturnType<typeof createClient>;
