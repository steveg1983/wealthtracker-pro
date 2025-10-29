/**
 * Database Configuration
 * Controls whether to use Supabase or localStorage
 */

// Check if Supabase is configured
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Enable Supabase if credentials are provided
export const USE_SUPABASE = Boolean(supabaseUrl && supabaseKey);

// Feature flags
export const FEATURES = {
  // Use Supabase for data storage
  supabase: USE_SUPABASE,
  
  // Enable real-time sync
  realtime: USE_SUPABASE,
  
  // Enable multi-device sync
  multiDevice: USE_SUPABASE,
  
  // Show sync status indicator
  syncStatus: USE_SUPABASE,
  
  // Enable offline mode
  offline: true,
  
  // Show data source indicator (for debugging)
  showDataSource: import.meta.env.DEV
};

// Export which AppContext to use
export { AppProvider as AppProviderLocal } from '../contexts/AppContextSupabase';
export { AppProvider as AppProviderSupabase } from '../contexts/AppContextSupabase';

// Use Supabase version if configured, otherwise use local
export const AppProvider = USE_SUPABASE 
  ? require('../contexts/AppContextSupabase').AppProvider
  : require('../contexts/AppContext').AppProvider;

// Helper to get current data source
export const getDataSource = (): 'supabase' | 'localStorage' => {
  return USE_SUPABASE ? 'supabase' : 'localStorage';
};

// Helper to check if we're in demo mode
export const isDemoMode = (): boolean => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('demo') === 'true';
};