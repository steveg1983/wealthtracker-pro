import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { ensureSupabaseClient } from '../lib/supabase';
import { useUserId } from '../hooks/useUserId';
import { lazyLogger as logger } from '../services/serviceFactory';

const SERVICE_PREFIX = '[RealtimeSyncTest]';

const TEST_ACCOUNT_DELETE_DELAY = 5000;
const TEST_ACCOUNT_CREATE_DELAY = 2000;
const EVENT_HISTORY_LIMIT = 50;

export default function RealtimeSyncTest() {
  const { clerkId, databaseId, isLoading } = useUserId();
  const isMountedRef = useRef(false);
  const [testStatus, setTestStatus] = useState<string[]>([]);
  const [dbUserId, setDbUserId] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const createTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const log = useMemo(() => ({
    info: (message: string, meta?: Record<string, unknown>) => logger.info(`${SERVICE_PREFIX} ${message}`, meta),
    warn: (message: string, meta?: Record<string, unknown>) => logger.warn(`${SERVICE_PREFIX} ${message}`, meta),
    error: (message: string, error?: unknown) => logger.error(`${SERVICE_PREFIX} ${message}`, error),
    debug: (message: string, meta?: Record<string, unknown>) => logger.debug(`${SERVICE_PREFIX} ${message}`, meta)
  }), []);

  const addStatus = (message: string) => {
    log.info(message);
    if (!isMountedRef.current) {
      return;
    }
    setTestStatus(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`].slice(-EVENT_HISTORY_LIMIT));
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isLoading) {
      addStatus('Loading user information...');
      return;
    }

    if (!databaseId) {
      addStatus('No user logged in or database user not found');
      return;
    }

    let cancelled = false;
    let client: SupabaseClient<any> | null = null;

    const runTest = async () => {
      try {
        client = await ensureSupabaseClient();
        if (cancelled || !client || (client as any).__isStub) {
          addStatus('Supabase is not configured for realtime testing');
          return;
        }

        if (cancelled) {
          return;
        }

        if (isMountedRef.current) {
          setDbUserId(databaseId);
        }
        addStatus(`Starting test for Clerk user: ${clerkId}`);
        addStatus(`Using database ID: ${databaseId}`);

        const activeClient = client;
        if (!activeClient) {
          addStatus('Supabase client unavailable');
          return;
        }

        const activeChannels = activeClient.getChannels();
        addStatus(`Active channels: ${activeChannels.length}`);
        activeChannels.forEach(ch => {
          addStatus(`  - ${ch.topic}: ${ch.state}`);
        });

        addStatus('Setting up realtime subscription...');
        channelRef.current = activeClient
          .channel(`test-accounts-${databaseId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'accounts',
              filter: `user_id=eq.${databaseId}`
            },
            payload => {
              addStatus(`🎯 REALTIME EVENT RECEIVED: ${payload.eventType}`);
              log.debug('Realtime payload', { payload });
            }
          )
          .subscribe((status, error) => {
            addStatus(`Subscription status: ${status}`);
            if (error) {
              addStatus(`Subscription error: ${error.message}`);
              log.error('Subscription error', error);
            }
          });

        createTimeoutRef.current = setTimeout(async () => {
          createTimeoutRef.current = null;
          if (cancelled) {
            return;
          }
          addStatus('Creating test account...');

          const testAccount = {
            user_id: databaseId,
            name: `Test Account ${Date.now()}`,
            type: 'savings',
            currency: 'GBP',
            balance: 100,
            initial_balance: 100,
            is_active: true
          };

          const { data, error } = await activeClient
            .from('accounts')
            .insert(testAccount)
            .select()
            .single();

          if (error) {
            addStatus(`Error creating test account: ${error.message}`);
            log.error('Create test account failed', error);
            return;
          }

          addStatus(`✅ Test account created: ${data.name}`);
          addStatus('You should see a realtime event above if sync is working!');

          deleteTimeoutRef.current = setTimeout(async () => {
            deleteTimeoutRef.current = null;
            if (cancelled) {
              return;
            }
            addStatus('Deleting test account...');
            const { error: deleteError } = await activeClient
              .from('accounts')
              .delete()
              .eq('id', data.id);

            if (deleteError) {
              addStatus(`Error deleting: ${deleteError.message}`);
              log.error('Delete test account failed', deleteError);
            } else {
              addStatus('✅ Test account deleted');
            }
          }, TEST_ACCOUNT_DELETE_DELAY);
        }, TEST_ACCOUNT_CREATE_DELAY);

        return () => {
          if (createTimeoutRef.current) {
            clearTimeout(createTimeoutRef.current);
            createTimeoutRef.current = null;
          }
          if (deleteTimeoutRef.current) {
            clearTimeout(deleteTimeoutRef.current);
            deleteTimeoutRef.current = null;
          }
          addStatus('Cleaning up subscription...');
          const teardownClient = activeClient ?? client;
          if (teardownClient && channelRef.current) {
            teardownClient.removeChannel(channelRef.current);
          }
        };
      } catch (error) {
        addStatus('Failed to initialise realtime sync test');
        log.error('Realtime sync setup failed', error);
        return undefined;
      }
    };

    let cleanup: (() => void) | undefined;

    runTest().then(dispose => {
      cleanup = dispose;
    });

    return () => {
      cancelled = true;
      if (createTimeoutRef.current) {
        clearTimeout(createTimeoutRef.current);
        createTimeoutRef.current = null;
      }
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
        deleteTimeoutRef.current = null;
      }
      if (cleanup) {
        cleanup();
      }
      const teardownClient = client;
      if (teardownClient && channelRef.current) {
        teardownClient.removeChannel(channelRef.current);
      }
      channelRef.current = null;
      client = null;
    };
  }, [clerkId, databaseId, isLoading, log]);

  return (
    <div className="fixed top-20 right-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg max-w-md max-h-96 overflow-y-auto z-50 border-2 border-gray-500">
      <h3 className="font-bold text-sm mb-2 text-gray-600">🧪 Realtime Sync Test</h3>
      <div className="text-xs space-y-1 font-mono">
        <div>Clerk ID: {clerkId?.slice(0, 10)}...</div>
        <div>DB ID: {dbUserId?.slice(0, 10)}...</div>
        <div className="mt-2 border-t pt-2">
          {testStatus.map((status, i) => (
            <div
              key={i}
              className={`${
                status.includes('ERROR') || status.includes('Error')
                  ? 'text-red-600'
                  : status.includes('✅') || status.includes('🎯')
                    ? 'text-green-600'
                    : 'text-gray-600'
              }`}
            >
              {status}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
