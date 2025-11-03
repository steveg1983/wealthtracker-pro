import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useUserId } from '../hooks/useUserId';

export default function RealtimeSyncTest() {
  const { clerkId, databaseId, isLoading } = useUserId();
  const [testStatus, setTestStatus] = useState<string[]>([]);
  const [dbUserId, setDbUserId] = useState<string | null>(null);

  const addStatus = (message: string) => {
    console.log(`[RealtimeSyncTest] ${message}`);
    setTestStatus(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    if (isLoading) {
      addStatus('Loading user information...');
      return;
    }

    if (!databaseId) {
      addStatus('No user logged in or database user not found');
      return;
    }

    const runTest = async () => {
      addStatus(`Starting test for Clerk user: ${clerkId}`);
      addStatus(`Using database ID: ${databaseId}`);

      setDbUserId(databaseId);

      // Step 2: Check current channels
      const channels = supabase!.getChannels();
      addStatus(`Active channels: ${channels.length}`);
      channels.forEach(ch => {
        addStatus(`  - ${ch.topic}: ${ch.state}`);
      });

      // Step 3: Set up subscription
      addStatus('Setting up realtime subscription...');
      
      const channel = supabase
        .channel(`test-accounts-${databaseId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'accounts',
            filter: `user_id=eq.${databaseId}`
          },
          (payload) => {
            addStatus(`🎯 REALTIME EVENT RECEIVED: ${payload.eventType}`);
            console.log('Full payload:', payload);
          }
        )
        .subscribe((status, error) => {
          addStatus(`Subscription status: ${status}`);
          if (error) {
            addStatus(`Subscription error: ${error.message}`);
          }
        });

      // Step 4: Test creating an account after 2 seconds
      setTimeout(async () => {
        addStatus('Creating test account...');
        
        const testAccount = {
          user_id: dbUserId,
          name: `Test Account ${Date.now()}`,
          type: 'savings',
          currency: 'GBP',
          balance: 100,
          initial_balance: 100,
          is_active: true
        };

        const { data, error } = await supabase!
          .from('accounts')
          .insert(testAccount)
          .select()
          .single();

        if (error) {
          addStatus(`Error creating test account: ${error.message}`);
        } else {
          addStatus(`✅ Test account created: ${data.name}`);
          addStatus('You should see a realtime event above if sync is working!');
          
          // Delete after 5 seconds
          setTimeout(async () => {
            addStatus('Deleting test account...');
            const { error: deleteError } = await supabase!
              .from('accounts')
              .delete()
              .eq('id', data.id);
            
            if (deleteError) {
              addStatus(`Error deleting: ${deleteError.message}`);
            } else {
              addStatus('✅ Test account deleted');
            }
          }, 5000);
        }
      }, 2000);

      // Cleanup
      return () => {
        addStatus('Cleaning up subscription...');
        supabase!.removeChannel(channel);
      };
    };

    runTest();
  }, [clerkId, databaseId, isLoading]);

  return (
    <div className="fixed top-20 right-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg max-w-md max-h-96 overflow-y-auto z-50 border-2 border-blue-500">
      <h3 className="font-bold text-sm mb-2 text-blue-600">🧪 Realtime Sync Test</h3>
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