const defaultResponse = { data: null, error: null };

const createQueryBuilder = () => {
  const builder: Record<string, any> = {};
  const chain = () => builder;

  Object.assign(builder, {
    select: chain,
    insert: chain,
    upsert: chain,
    update: chain,
    delete: chain,
    eq: chain,
    match: chain,
    in: chain,
    order: chain,
    limit: chain,
    range: chain,
    filter: chain,
    single: async () => defaultResponse,
    maybeSingle: async () => defaultResponse,
    returns: chain,
    then: (resolve: (value: typeof defaultResponse) => unknown) => {
      resolve(defaultResponse);
      return builder;
    },
    catch: () => builder,
    finally: (handler: () => unknown) => {
      handler();
      return builder;
    }
  });

  return builder;
};

const createStorageBucket = () => ({
  upload: async () => defaultResponse,
  remove: async () => defaultResponse,
  download: async () => ({ data: null, error: null }),
  list: async () => ({ data: [], error: null }),
  getPublicUrl: () => ({ data: { publicUrl: '' } }),
  update: async () => defaultResponse
});

export const createClient = () => {
  const channelApi = {
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
