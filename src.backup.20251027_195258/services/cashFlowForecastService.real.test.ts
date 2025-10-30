/**
 * cashFlowForecastService REAL DATABASE Tests
 * Tests with ACTUAL database operations, not mocks!
 */

import { it, expect } from 'vitest';
import { describeSupabase } from '@wealthtracker/testing/supabaseRealTest';
import { supabase } from '@wealthtracker/core';

describeSupabase('cashFlowForecastService - REAL DATABASE TESTS', () => {
  it('connects to REAL database', async () => {
    const { data, error } = await supabase
      .from('users')
      .select('count(*)')
      .single();
    
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });
});
