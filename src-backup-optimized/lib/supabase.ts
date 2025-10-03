import { createClient } from '@supabase/supabase-js';
import type { UserResource } from '@clerk/types';

// These should be in your .env file
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Sync Clerk user data with Supabase user table
 * Creates or updates user record in Supabase when user signs in
 */
export async function syncClerkUser(clerkUser: UserResource): Promise<void> {
  try {
    const userData = {
      id: clerkUser.id,
      email: clerkUser.primaryEmailAddress?.emailAddress || '',
      first_name: clerkUser.firstName || '',
      last_name: clerkUser.lastName || '',
      full_name: clerkUser.fullName || '',
      image_url: clerkUser.imageUrl || '',
      created_at: clerkUser.createdAt ? new Date(clerkUser.createdAt).toISOString() : new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_sign_in_at: clerkUser.lastSignInAt ? new Date(clerkUser.lastSignInAt).toISOString() : null,
      email_verified: clerkUser.primaryEmailAddress?.verification?.status === 'verified',
      has_mfa: clerkUser.totpEnabled || clerkUser.backupCodeEnabled || clerkUser.twoFactorEnabled
    };

    // Upsert user data (insert or update if exists)
    const { error } = await supabase
      .from('users')
      .upsert(userData, {
        onConflict: 'id'
      });

    if (error) {
      console.error('Error syncing user with Supabase:', error);
      throw error;
    }

    console.log('User synced successfully with Supabase');
  } catch (error) {
    console.error('Failed to sync user with Supabase:', error);
    // Don't throw here to avoid blocking auth flow
  }
}