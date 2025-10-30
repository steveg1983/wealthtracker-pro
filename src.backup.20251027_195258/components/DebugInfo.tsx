import React from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { isSupabaseConfigured } from '@wealthtracker/core';

export default function DebugInfo(): React.JSX.Element {
  const { user, isLoaded: userLoaded, isSignedIn } = useUser();
  const { isLoaded: authLoaded } = useAuth();
  
  // Only show in development
  if (!import.meta.env.DEV) return <></>;
  
  return (
    <div className="fixed top-20 right-4 z-50 bg-black text-white p-4 rounded-lg text-xs max-w-sm">
      <h3 className="font-bold mb-2">Debug Info</h3>
      <div className="space-y-1">
        <div>Auth Loaded: {String(authLoaded)}</div>
        <div>User Loaded: {String(userLoaded)}</div>
        <div>Signed In: {String(isSignedIn)}</div>
        <div>User ID: {user?.id || 'none'}</div>
        <div>Supabase: {String(isSupabaseConfigured())}</div>
        <div>Supabase URL: {import.meta.env.VITE_SUPABASE_URL ? '✓' : '✗'}</div>
        <div>Supabase Key: {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✓' : '✗'}</div>
        <div>Clerk Key: {import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ? '✓' : '✗'}</div>
      </div>
    </div>
  );
}