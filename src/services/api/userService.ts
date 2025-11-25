
import { supabase, isSupabaseConfigured, handleSupabaseError } from './supabaseClient';
import type { User } from '../../types';
import { storageAdapter } from '../storageAdapter';

type SupabaseClientLike = typeof supabase;
type SupabaseConfiguredChecker = () => boolean;
type StorageAdapterLike = Pick<typeof storageAdapter, 'get' | 'set'>;
type Logger = Pick<Console, 'error' | 'warn' | 'log'>;
type DateProvider = () => Date;
type LocalStorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export interface UserServiceOptions {
  supabaseClient?: SupabaseClientLike;
  isSupabaseConfigured?: SupabaseConfiguredChecker;
  storageAdapter?: StorageAdapterLike;
  localStorage?: LocalStorageLike | null;
  logger?: Logger;
  now?: DateProvider;
}

class UserServiceImpl {
  private readonly supabaseClient: SupabaseClientLike;
  private readonly supabaseChecker: SupabaseConfiguredChecker;
  private readonly storage: StorageAdapterLike;
  private readonly localStorageRef: LocalStorageLike | null;
  private readonly logger: Logger;
  private readonly nowProvider: DateProvider;

  constructor(options: UserServiceOptions = {}) {
    this.supabaseClient = options.supabaseClient ?? supabase;
    this.supabaseChecker = options.isSupabaseConfigured ?? isSupabaseConfigured;
    this.storage = options.storageAdapter ?? storageAdapter;
    if ('localStorage' in options) {
      this.localStorageRef = options.localStorage ?? null;
    } else {
      this.localStorageRef = typeof window !== 'undefined' ? window.localStorage : null;
    }
    const fallbackLogger = typeof console !== 'undefined' ? console : undefined;
    const noop = () => {};
    this.logger = {
      error: options.logger?.error ?? (fallbackLogger?.error?.bind(fallbackLogger) ?? noop),
      warn: options.logger?.warn ?? (fallbackLogger?.warn?.bind(fallbackLogger) ?? noop),
      log: options.logger?.log ?? (fallbackLogger?.log?.bind(fallbackLogger) ?? noop)
    };
    this.nowProvider = options.now ?? (() => new Date());
  }

  private isSupabaseReady(): boolean {
    return Boolean(this.supabaseClient && this.supabaseChecker());
  }

  private nowIso(): string {
    return this.nowProvider().toISOString();
  }

  private persistLocally(key: string, value: Record<string, unknown>): void {
    if (!this.localStorageRef) {
      this.logger.warn(`Local storage unavailable; skipping write for ${key}`);
      return;
    }
    try {
      this.localStorageRef.setItem(key, JSON.stringify(value));
    } catch (error) {
      this.logger.error(`Failed to persist ${key}:`, error as Error);
    }
  }

  async getOrCreateUser(clerkId: string, email: string, firstName?: string, lastName?: string): Promise<User | null> {
    if (!this.isSupabaseReady()) {
      this.logger.warn('Supabase not configured, using local storage');
      return null;
    }

    try {
      const client = this.supabaseClient!;
      const { data: existingUser, error: fetchError } = await client
        .from('users')
        .select('*')
        .eq('clerk_id', clerkId)
        .single();

      if (existingUser) {
        return existingUser as User;
      }

      if (fetchError?.code === 'PGRST116') {
        const { data: newUser, error: createError } = await client
          .from('users')
          .insert({
            clerk_id: clerkId,
            email,
            first_name: firstName,
            last_name: lastName,
            subscription_tier: 'free',
            subscription_status: 'active',
            settings: {},
            preferences: {}
          } as never)
          .select()
          .single();

        if (createError) {
          this.logger.error('Error creating user:', createError);
          throw new Error(handleSupabaseError(createError));
        }

        return newUser as User;
      }

      if (fetchError) {
        this.logger.error('Error fetching user:', fetchError);
        throw new Error(handleSupabaseError(fetchError));
      }

      return null;
    } catch (error) {
      this.logger.error('UserService.getOrCreateUser error:', error as Error);
      throw error;
    }
  }

  async updateUser(clerkId: string, updates: Partial<User>): Promise<User | null> {
    if (!this.isSupabaseReady()) {
      return null;
    }

    try {
      const client = this.supabaseClient!;
      const { data, error } = await client
        .from('users')
        .update(updates as never)
        .eq('clerk_id', clerkId)
        .select()
        .single();

      if (error) {
        this.logger.error('Error updating user:', error);
        throw new Error(handleSupabaseError(error));
      }

      return data as User;
    } catch (error) {
      this.logger.error('UserService.updateUser error:', error as Error);
      throw error;
    }
  }

  async updatePreferences(clerkId: string, preferences: Record<string, unknown>): Promise<void> {
    if (!this.isSupabaseReady()) {
      this.persistLocally('wealthtracker_preferences', preferences);
      return;
    }

    try {
      const client = this.supabaseClient!;
      const { error } = await client
        .from('users')
        .update({ preferences } as never)
        .eq('clerk_id', clerkId);

      if (error) {
        this.logger.error('Error updating preferences:', error);
        throw new Error(handleSupabaseError(error));
      }
    } catch (error) {
      this.logger.error('UserService.updatePreferences error:', error as Error);
      throw error;
    }
  }

  async updateSettings(clerkId: string, settings: Record<string, unknown>): Promise<void> {
    if (!this.isSupabaseReady()) {
      this.persistLocally('wealthtracker_settings', settings);
      return;
    }

    try {
      const client = this.supabaseClient!;
      const { error } = await client
        .from('users')
        .update({ settings } as never)
        .eq('clerk_id', clerkId);

      if (error) {
        this.logger.error('Error updating settings:', error);
        throw new Error(handleSupabaseError(error));
      }
    } catch (error) {
      this.logger.error('UserService.updateSettings error:', error as Error);
      throw error;
    }
  }

  async getUserByClerkId(clerkId: string): Promise<User | null> {
    if (!this.isSupabaseReady()) {
      return null;
    }

    try {
      const client = this.supabaseClient!;
      const { data, error } = await client
        .from('users')
        .select('*')
        .eq('clerk_id', clerkId)
        .single();

      if (error) {
        if ((error as { code?: string }).code === 'PGRST116') {
          return null;
        }
        this.logger.error('Error fetching user:', error);
        throw new Error(handleSupabaseError(error));
      }

      return data as User;
    } catch (error) {
      this.logger.error('UserService.getUserByClerkId error:', error as Error);
      throw error;
    }
  }

  async updateLastSync(clerkId: string): Promise<void> {
    if (!this.isSupabaseReady()) {
      return;
    }

    try {
      const client = this.supabaseClient!;
      const { error } = await client
        .from('users')
        .update({ last_sync_at: this.nowIso() } as never)
        .eq('clerk_id', clerkId);

      if (error) {
        this.logger.error('Error updating last sync:', error);
        throw new Error(handleSupabaseError(error));
      }
    } catch (error) {
      this.logger.error('UserService.updateLastSync error:', error as Error);
      throw error;
    }
  }
}

let defaultUserService = new UserServiceImpl();

export class UserService {
  static configure(options: UserServiceOptions = {}) {
    defaultUserService = new UserServiceImpl(options);
  }

  private static get service(): UserServiceImpl {
    return defaultUserService;
  }

  static getOrCreateUser(clerkId: string, email: string, firstName?: string, lastName?: string): Promise<User | null> {
    return this.service.getOrCreateUser(clerkId, email, firstName, lastName);
  }

  static updateUser(clerkId: string, updates: Partial<User>): Promise<User | null> {
    return this.service.updateUser(clerkId, updates);
  }

  static updatePreferences(clerkId: string, preferences: Record<string, unknown>): Promise<void> {
    return this.service.updatePreferences(clerkId, preferences);
  }

  static updateSettings(clerkId: string, settings: Record<string, unknown>): Promise<void> {
    return this.service.updateSettings(clerkId, settings);
  }

  static getUserByClerkId(clerkId: string): Promise<User | null> {
    return this.service.getUserByClerkId(clerkId);
  }

  static updateLastSync(clerkId: string): Promise<void> {
    return this.service.updateLastSync(clerkId);
  }
}

export const createUserService = (options: UserServiceOptions = {}) => new UserServiceImpl(options);
