import type { Database } from '@wealthtracker/types';

type Tables = Database['public']['Tables'];

type UserRow = Tables['users']['Row'];
type UserInsert = Tables['users']['Insert'];

type UserIdMappingRow = Tables['user_id_mappings']['Row'];
type UserIdMappingInsert = Tables['user_id_mappings']['Insert'];

const randomId = (prefix: string): string => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

const isoNow = (): string => new Date().toISOString();

export const buildUserRow = (overrides: Partial<UserRow> = {}): UserRow => {
  const createdAt = overrides.created_at ?? isoNow();
  const updatedAt = overrides.updated_at ?? createdAt;
  return {
    id: overrides.id ?? randomId('user'),
    clerk_id: overrides.clerk_id ?? randomId('clerk'),
    email: overrides.email ?? 'user@example.com',
    first_name: overrides.first_name ?? null,
    last_name: overrides.last_name ?? null,
    avatar_url: overrides.avatar_url ?? null,
    full_name: overrides.full_name ?? null,
    image_url: overrides.image_url ?? null,
    subscription_tier: overrides.subscription_tier ?? 'free',
    subscription_status: overrides.subscription_status ?? 'active',
    stripe_customer_id: overrides.stripe_customer_id ?? null,
    created_at: createdAt,
    updated_at: updatedAt,
    last_sync_at: overrides.last_sync_at ?? null,
    settings: overrides.settings ?? {},
    preferences: overrides.preferences ?? {},
    last_sign_in_at: overrides.last_sign_in_at ?? null,
    email_verified: overrides.email_verified ?? null,
    has_mfa: overrides.has_mfa ?? null,
  };
};

export const buildUserInsert = (overrides: Partial<UserInsert> = {}): UserInsert => {
  const createdAt = overrides.created_at ?? isoNow();
  const updatedAt = overrides.updated_at ?? createdAt;
  return {
    id: overrides.id,
    clerk_id: overrides.clerk_id ?? randomId('clerk'),
    email: overrides.email ?? 'user@example.com',
    first_name: overrides.first_name ?? null,
    last_name: overrides.last_name ?? null,
    avatar_url: overrides.avatar_url ?? null,
    full_name: overrides.full_name ?? null,
    image_url: overrides.image_url ?? null,
    subscription_tier: overrides.subscription_tier ?? 'free',
    subscription_status: overrides.subscription_status ?? 'active',
    stripe_customer_id: overrides.stripe_customer_id ?? null,
    created_at: createdAt,
    updated_at: updatedAt,
    last_sync_at: overrides.last_sync_at ?? null,
    settings: overrides.settings ?? {},
    preferences: overrides.preferences ?? {},
    last_sign_in_at: overrides.last_sign_in_at ?? null,
    email_verified: overrides.email_verified ?? null,
    has_mfa: overrides.has_mfa ?? null,
  };
};

export const buildUserIdMappingRow = (overrides: Partial<UserIdMappingRow> = {}): UserIdMappingRow => {
  const createdAt = overrides.created_at ?? isoNow();
  const updatedAt = overrides.updated_at ?? createdAt;
  return {
    id: overrides.id ?? randomId('mapping'),
    clerk_id: overrides.clerk_id ?? randomId('clerk'),
    database_user_id: overrides.database_user_id ?? randomId('db'),
    created_at: createdAt,
    updated_at: updatedAt,
  };
};

export const buildUserIdMappingInsert = (
  overrides: Partial<UserIdMappingInsert> = {},
): UserIdMappingInsert => {
  const createdAt = overrides.created_at ?? isoNow();
  const updatedAt = overrides.updated_at ?? createdAt;
  return {
    id: overrides.id,
    clerk_id: overrides.clerk_id ?? randomId('clerk'),
    database_user_id: overrides.database_user_id ?? randomId('db'),
    created_at: createdAt,
    updated_at: updatedAt,
  };
};
