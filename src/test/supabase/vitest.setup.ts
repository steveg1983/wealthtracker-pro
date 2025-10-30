import { beforeAll, afterAll } from 'vitest';
import { supabaseService } from './client';

beforeAll(() => {
  if (!supabaseService) {
    throw new Error('[supabase-smoke] VITE_SUPABASE_SERVICE_ROLE_KEY is required');
  }
});

afterAll(async () => {
  // Placeholder for any global cleanup if needed
});
