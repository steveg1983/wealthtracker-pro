/**
 * React Hook for User ID Management
 * 
 * This hook provides easy access to both Clerk and database user IDs
 * throughout the application. It handles loading states and automatic
 * updates when the user changes.
 * 
 * Usage:
 * ```typescript
 * const { clerkId, databaseId, isLoading } = useUserId();
 * 
 * // Use databaseId for all database queries
 * const accounts = await getAccounts(databaseId);
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import { userIdService, type ClerkUserId, type DatabaseUserId } from '../services/userIdService';
import { logger } from '../services/loggingService';

interface UseUserIdReturn {
  /** The Clerk authentication ID (e.g., "user_2abc123...") */
  clerkId: ClerkUserId | null;
  
  /** The database UUID (e.g., "a14bdc0e-2055-45d4-ab86-d86c03309416") */
  databaseId: DatabaseUserId | null;
  
  /** Whether the IDs are still being loaded */
  isLoading: boolean;
  
  /** Any error that occurred during ID resolution */
  error: string | null;
  
  /** Force refresh the database ID (useful after user creation) */
  refresh: () => Promise<void>;
}

/**
 * Hook to get both Clerk and database user IDs
 * @returns Object with both IDs, loading state, and error
 */
export function useUserId(): UseUserIdReturn {
  const { user, isLoaded } = useUser();
  const [databaseId, setDatabaseId] = useState<DatabaseUserId | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDatabaseId = useCallback(async (clerkId: ClerkUserId) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // First check if we already have it cached in the service
      let dbId = userIdService.getCurrentDatabaseUserId();
      
      // If not cached or different user, fetch it
      if (!dbId || userIdService.getCurrentClerkId() !== clerkId) {
        logger.info('[useUserId] Fetching database ID for Clerk ID', { clerkId });
        
        // For logged-in users with email, ensure they exist in database
        if (user?.emailAddresses?.[0]?.emailAddress) {
          dbId = await userIdService.ensureUserExists(
            clerkId,
            user.emailAddresses[0].emailAddress,
            user.firstName || undefined,
            user.lastName || undefined
          );
        } else {
          // Just try to get existing ID
          dbId = await userIdService.getDatabaseUserId(clerkId);
        }
        
        // Update the current user in the service
        if (dbId) {
          await userIdService.setCurrentUser(clerkId, dbId);
        }
      }
      
      setDatabaseId(dbId);
      
      if (!dbId) {
        logger.warn('[useUserId] No database ID found for Clerk ID:', clerkId);
      } else {
        logger.info('[useUserId] Database ID resolved', { dbId });
      }
    } catch (err) {
      logger.error('[useUserId] Error fetching database ID:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch database ID');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isLoaded) {
      setIsLoading(true);
      return;
    }

    if (user?.id) {
      fetchDatabaseId(user.id);
    } else {
      // No user logged in
      setDatabaseId(null);
      setIsLoading(false);
      userIdService.clearCache();
    }
  }, [fetchDatabaseId, isLoaded, user?.id]);

  const refresh = async () => {
    if (user?.id) {
      await fetchDatabaseId(user.id);
    }
  };

  return {
    clerkId: user?.id || null,
    databaseId,
    isLoading: !isLoaded || isLoading,
    error,
    refresh
  };
}

/**
 * Hook to get only the database user ID
 * Convenience wrapper for when you only need the database ID
 * 
 * @returns The database UUID or null
 */
export function useDatabaseUserId(): DatabaseUserId | null {
  const { databaseId } = useUserId();
  return databaseId;
}

/**
 * Hook that throws if no database ID is available
 * Use this in components that require a logged-in user
 * 
 * @returns The database UUID (never null)
 * @throws Error if no database ID is available
 */
export function useRequiredDatabaseUserId(): DatabaseUserId {
  const { databaseId, isLoading } = useUserId();
  
  if (!isLoading && !databaseId) {
    throw new Error('No database user ID available. User may not be logged in or database user may not exist.');
  }
  
  // Return empty string while loading to prevent errors
  // Components should check isLoading before using this
  return databaseId || '';
}
