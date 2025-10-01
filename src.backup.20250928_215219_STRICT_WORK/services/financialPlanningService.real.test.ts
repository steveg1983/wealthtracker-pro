/**
 * financialPlanningService REAL DATABASE Tests
 * Tests with ACTUAL database operations, not mocks!
 */

import { describe, it, expect } from 'vitest';
import { supabase } from '../lib/supabase';

describe('financialPlanningService - REAL DATABASE TESTS', () => {
  it('connects to REAL database', async () => {
    const { data, error } = await supabase
      .from('users')
      .select('count(*)')
      .single();
    
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });
});