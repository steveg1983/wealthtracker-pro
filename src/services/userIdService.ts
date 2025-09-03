/**
 * Centralized User ID Service
 * 
 * This service handles the conversion between Clerk authentication IDs and database user IDs.
 * It provides a single source of truth for ID management throughout the application.
 * 
 * Problem it solves:
 * - Clerk provides string IDs (e.g., "user_2abc123...")
 * - Database uses UUIDs (e.g., "a14bdc0e-2055-45d4-ab86-d86c03309416")
 * - All database tables reference the UUID, not the Clerk ID
 * 
 * Usage:
 * - Use getDatabaseUserId() when you need the database UUID for queries
 * - Use getCurrentDatabaseUserId() to get the current user's database ID
 * - The service caches mappings to avoid repeated database queries
 */

import { supabase, isSupabaseConfigured } from './api/supabaseClient';
import { UserService } from './api/userService';
import { logger } from './loggingService';

// Types for clarity
export type ClerkUserId = string; // Format: "user_2abc123..."
export type DatabaseUserId = string; // Format: UUID

interface UserIdMapping {
  clerkId: ClerkUserId;
  databaseId: DatabaseUserId;
  timestamp: number;
}

class UserIdService {
  private cache: Map<ClerkUserId, UserIdMapping> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private currentClerkId: ClerkUserId | null = null;
  private currentDatabaseId: DatabaseUserId | null = null;

  /**
   * Get the database user ID from a Clerk ID
   * @param clerkId - The Clerk authentication ID
   * @returns The database UUID or null if not found
   */
  async getDatabaseUserId(clerkId: ClerkUserId): Promise<DatabaseUserId | null> {
    if (!clerkId) {
      logger.warn('[UserIdService] No Clerk ID provided');
      return null;
    }

    // Check cache first
    const cached = this.cache.get(clerkId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      logger.debug('[UserIdService] Using cached database ID for Clerk ID', { clerkId });
      return cached.databaseId;
    }

    // If not using Supabase, return null (localStorage mode)
    if (!isSupabaseConfigured() || !supabase) {
      logger.info('[UserIdService] Supabase not configured, using localStorage mode');
      return null;
    }

    try {
      logger.info('[UserIdService] Fetching database ID for Clerk ID', { clerkId });
      
      // Query the users table to get the database ID
      const { data: user, error } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_id', clerkId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // Not found
          logger.info('[UserIdService] User not found for Clerk ID', { clerkId });
          return null;
        }
        logger.error('[UserIdService] Error fetching user:', error);
        return null;
      }

      if (!user) {
      logger.info('[UserIdService] No user found for Clerk ID', { clerkId });
        return null;
      }

      // Cache the mapping
      this.cache.set(clerkId, {
        clerkId,
        databaseId: user.id,
        timestamp: Date.now()
      });

      logger.info('[UserIdService] Found database ID', { databaseId: user.id, clerkId });
      return user.id;
    } catch (error) {
      logger.error('[UserIdService] Failed to get database user ID:', error);
      return null;
    }
  }

  /**
   * Set the current user (called on login/initialization)
   * @param clerkId - The current user's Clerk ID
   * @param databaseId - The current user's database ID (optional, will be fetched if not provided)
   */
  async setCurrentUser(clerkId: ClerkUserId, databaseId?: DatabaseUserId): Promise<void> {
    this.currentClerkId = clerkId;
    
    if (databaseId) {
      this.currentDatabaseId = databaseId;
      // Cache this mapping
      this.cache.set(clerkId, {
        clerkId,
        databaseId,
        timestamp: Date.now()
      });
    } else {
      // Fetch the database ID if not provided
      const fetchedId = await this.getDatabaseUserId(clerkId);
      this.currentDatabaseId = fetchedId;
    }

    logger.info('[UserIdService] Current user set', { clerkId, databaseId: this.currentDatabaseId });
  }

  /**
   * Get the current user's database ID
   * @returns The current user's database UUID or null
   */
  getCurrentDatabaseUserId(): DatabaseUserId | null {
    return this.currentDatabaseId;
  }

  /**
   * Get the current user's Clerk ID
   * @returns The current user's Clerk ID or null
   */
  getCurrentClerkId(): ClerkUserId | null {
    return this.currentClerkId;
  }

  /**
   * Get both IDs for the current user
   * @returns Object with both IDs
   */
  getCurrentUserIds(): { clerkId: ClerkUserId | null; databaseId: DatabaseUserId | null } {
    return {
      clerkId: this.currentClerkId,
      databaseId: this.currentDatabaseId
    };
  }

  /**
   * Clear the cache (useful for testing or logout)
   */
  clearCache(): void {
    this.cache.clear();
    this.currentClerkId = null;
    this.currentDatabaseId = null;
    logger.info('[UserIdService] Cache cleared');
  }

  /**
   * Ensure user exists in database (get or create)
   * This is useful when you need to guarantee a database user exists
   * @param clerkId - The Clerk ID
   * @param email - User's email (required for creation)
   * @param firstName - User's first name (optional)
   * @param lastName - User's last name (optional)
   * @returns The database user ID
   */
  async ensureUserExists(
    clerkId: ClerkUserId, 
    email: string, 
    firstName?: string, 
    lastName?: string
  ): Promise<DatabaseUserId | null> {
    try {
      // Try to get existing ID first
      let databaseId = await this.getDatabaseUserId(clerkId);
      
      if (!databaseId) {
        // User doesn't exist, create them
        logger.info('[UserIdService] User not found, creating new user');
        const user = await UserService.getOrCreateUser(clerkId, email, firstName, lastName);
        
        if (user) {
          databaseId = user.id;
          
          // Cache the new mapping
          this.cache.set(clerkId, {
            clerkId,
            databaseId,
            timestamp: Date.now()
          });
        }
      }
      
      // CRITICAL: Set this as the current user so getCurrentDatabaseUserId() works
      if (databaseId) {
        this.currentClerkId = clerkId;
        this.currentDatabaseId = databaseId;
        logger.info('[UserIdService] Current user set', { clerkId, databaseId });
      }
      
      return databaseId;
    } catch (error) {
      logger.error('[UserIdService] Failed to ensure user exists:', error);
      return null;
    }
  }

  /**
   * Debug function to log current state
   */
  debug(): void {
    logger.info('[UserIdService] Debug Info');
    logger.info('Current IDs', { clerkId: this.currentClerkId, databaseId: this.currentDatabaseId });
    logger.info('Cache size', { size: this.cache.size });
    logger.info('Cache entries', Array.from(this.cache.entries()).map(([key, value]) => ({
      clerkId: key,
      databaseId: value.databaseId,
      age: Math.round((Date.now() - value.timestamp) / 1000) + 's'
    })));
  }
}

// Export a singleton instance
export const userIdService = new UserIdService();

// Export the service class for testing purposes
export { UserIdService };
