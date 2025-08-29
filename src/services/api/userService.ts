import { supabase, isSupabaseConfigured, handleSupabaseError } from './supabaseClient';
import { useUser } from '@clerk/clerk-react';
import type { User } from '../../types';

export class UserService {
  /**
   * Get or create user profile in Supabase
   */
  static async getOrCreateUser(clerkId: string, email: string, firstName?: string, lastName?: string): Promise<User | null> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, using local storage');
      return null;
    }

    try {
      // First, try to get existing user
      const { data: existingUser, error: fetchError } = await supabase!
        .from('users')
        .select('*')
        .eq('clerk_id', clerkId)
        .single();

      if (existingUser) {
        return existingUser;
      }

      // If user doesn't exist, create new user
      if (fetchError?.code === 'PGRST116') { // Not found error
        const { data: newUser, error: createError } = await supabase!
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
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating user:', createError);
          throw new Error(handleSupabaseError(createError));
        }

        return newUser;
      }

      // Handle other errors
      if (fetchError) {
        console.error('Error fetching user:', fetchError);
        throw new Error(handleSupabaseError(fetchError));
      }

      return null;
    } catch (error) {
      console.error('UserService.getOrCreateUser error:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  static async updateUser(clerkId: string, updates: Partial<User>): Promise<User | null> {
    if (!isSupabaseConfigured()) {
      return null;
    }

    try {
      const { data, error } = await supabase!
        .from('users')
        .update(updates)
        .eq('clerk_id', clerkId)
        .select()
        .single();

      if (error) {
        console.error('Error updating user:', error);
        throw new Error(handleSupabaseError(error));
      }

      return data;
    } catch (error) {
      console.error('UserService.updateUser error:', error);
      throw error;
    }
  }

  /**
   * Update user preferences
   */
  static async updatePreferences(clerkId: string, preferences: Record<string, any>): Promise<void> {
    if (!isSupabaseConfigured()) {
      // Fallback to localStorage
      localStorage.setItem('wealthtracker_preferences', JSON.stringify(preferences));
      return;
    }

    try {
      const { error } = await supabase!
        .from('users')
        .update({ preferences })
        .eq('clerk_id', clerkId);

      if (error) {
        console.error('Error updating preferences:', error);
        throw new Error(handleSupabaseError(error));
      }
    } catch (error) {
      console.error('UserService.updatePreferences error:', error);
      throw error;
    }
  }

  /**
   * Update user settings
   */
  static async updateSettings(clerkId: string, settings: Record<string, any>): Promise<void> {
    if (!isSupabaseConfigured()) {
      // Fallback to localStorage
      localStorage.setItem('wealthtracker_settings', JSON.stringify(settings));
      return;
    }

    try {
      const { error } = await supabase!
        .from('users')
        .update({ settings })
        .eq('clerk_id', clerkId);

      if (error) {
        console.error('Error updating settings:', error);
        throw new Error(handleSupabaseError(error));
      }
    } catch (error) {
      console.error('UserService.updateSettings error:', error);
      throw error;
    }
  }

  /**
   * Get user by Clerk ID
   */
  static async getUserByClerkId(clerkId: string): Promise<User | null> {
    if (!isSupabaseConfigured()) {
      return null;
    }

    try {
      const { data, error } = await supabase!
        .from('users')
        .select('*')
        .eq('clerk_id', clerkId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // Not found
          return null;
        }
        console.error('Error fetching user:', error);
        throw new Error(handleSupabaseError(error));
      }

      return data;
    } catch (error) {
      console.error('UserService.getUserByClerkId error:', error);
      throw error;
    }
  }

  /**
   * Update last sync timestamp
   */
  static async updateLastSync(clerkId: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }

    try {
      const { error } = await supabase!
        .from('users')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('clerk_id', clerkId);

      if (error) {
        console.error('Error updating last sync:', error);
        throw new Error(handleSupabaseError(error));
      }
    } catch (error) {
      console.error('UserService.updateLastSync error:', error);
      throw error;
    }
  }
}