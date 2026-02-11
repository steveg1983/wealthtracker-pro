/**
 * Database Configuration
 * Controls whether to use Supabase or localStorage
 */
import { isDemoModeRuntimeAllowed } from '../utils/runtimeMode';

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
export { AppProvider as AppProviderLocal } from '../contexts/AppContext';
export { AppProvider as AppProviderSupabase } from '../contexts/AppContextSupabase';
import { AppProvider as SupabaseProvider } from '../contexts/AppContextSupabase';
import { AppProvider as LocalProvider } from '../contexts/AppContext';

// Use Supabase version if configured, otherwise use local
export const AppProvider = USE_SUPABASE
  ? SupabaseProvider
  : LocalProvider;

// Helper to get current data source
export const getDataSource = (): 'supabase' | 'localStorage' => {
  return USE_SUPABASE ? 'supabase' : 'localStorage';
};

// Helper to check if we're in demo mode
export const isDemoMode = (): boolean => {
  if (!isDemoModeRuntimeAllowed(import.meta.env)) {
    return false;
  }
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('demo') === 'true';
};
