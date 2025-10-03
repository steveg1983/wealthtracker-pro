/**
 * useUserId Hook - Provides user ID mapping between Clerk and database
 *
 * Features:
 * - Clerk ID from authentication
 * - Database user ID conversion
 * - Loading states
 */

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { userIdService } from '../services/userIdService';
import { lazyLogger as logger } from '../services/serviceFactory';

interface UseUserIdReturn {
  clerkId: string | undefined;
  databaseId: string | undefined;
  isLoading: boolean;
  error: string | null;
}

export function useUserId(): UseUserIdReturn {
  const { user, isSignedIn, isLoaded } = useUser();
  const [databaseId, setDatabaseId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadUserId = async () => {
      if (!isLoaded) {
        return; // Still loading authentication state
      }

      if (!isSignedIn || !user?.id) {
        setDatabaseId(undefined);
        setIsLoading(false);
        setError(null);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Get database user ID from Clerk ID
        const dbUserId = await userIdService.getDatabaseUserId(user.id);
        setDatabaseId(dbUserId);

        logger.debug('User ID mapping loaded', {
          clerkId: user.id,
          databaseId: dbUserId
        });
      } catch (err) {
        logger.error('Error loading user ID mapping:', err);
        setError(err instanceof Error ? err.message : 'Failed to load user ID mapping');
        setDatabaseId(undefined);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserId();
  }, [isLoaded, isSignedIn, user?.id]);

  return {
    clerkId: user?.id,
    databaseId,
    isLoading,
    error
  };
}