/**
 * Supabase Mock for Testing
 * Provides a complete mock implementation of Supabase client
 */

import { vi } from 'vitest';

// Mock Supabase client
export const createClientMock = vi.fn(() => ({
  from: vi.fn((table: string) => ({
    select: vi.fn(() => ({
      data: [],
      error: null,
      eq: vi.fn(() => ({
        data: [],
        error: null,
        single: vi.fn(() => ({
          data: null,
          error: null,
        })),
      })),
      single: vi.fn(() => ({
        data: null,
        error: null,
      })),
      order: vi.fn(() => ({
        data: [],
        error: null,
      })),
      limit: vi.fn(() => ({
        data: [],
        error: null,
      })),
    })),
    insert: vi.fn(() => ({
      data: null,
      error: null,
      select: vi.fn(() => ({
        data: [],
        error: null,
        single: vi.fn(() => ({
          data: null,
          error: null,
        })),
      })),
    })),
    update: vi.fn(() => ({
      data: null,
      error: null,
      eq: vi.fn(() => ({
        data: null,
        error: null,
        select: vi.fn(() => ({
          data: [],
          error: null,
          single: vi.fn(() => ({
            data: null,
            error: null,
          })),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => ({
        data: null,
        error: null,
      })),
    })),
    upsert: vi.fn(() => ({
      data: null,
      error: null,
      select: vi.fn(() => ({
        data: [],
        error: null,
      })),
    })),
  })),
  auth: {
    getUser: vi.fn(() => ({
      data: { user: null },
      error: null,
    })),
    getSession: vi.fn(() => ({
      data: { session: null },
      error: null,
    })),
    signInWithPassword: vi.fn(() => ({
      data: { user: null, session: null },
      error: null,
    })),
    signOut: vi.fn(() => ({
      error: null,
    })),
    onAuthStateChange: vi.fn((callback) => {
      return {
        data: { subscription: { unsubscribe: vi.fn() } },
        error: null,
      };
    }),
  },
  storage: {
    from: vi.fn((bucket: string) => ({
      upload: vi.fn(() => ({
        data: null,
        error: null,
      })),
      download: vi.fn(() => ({
        data: null,
        error: null,
      })),
      remove: vi.fn(() => ({
        data: [],
        error: null,
      })),
      getPublicUrl: vi.fn((path: string) => ({
        data: { publicUrl: `https://mock.supabase.co/storage/v1/public/${bucket}/${path}` },
      })),
    })),
  },
  rpc: vi.fn(() => ({
    data: null,
    error: null,
  })),
  channel: vi.fn((name: string) => ({
    on: vi.fn(() => ({
      subscribe: vi.fn(() => ({
        unsubscribe: vi.fn(),
      })),
    })),
    subscribe: vi.fn(() => ({
      unsubscribe: vi.fn(),
    })),
  })),
}));

// Export mock
export const supabaseMock = createClientMock();

// Mock the actual Supabase module
vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

// Mock the lib/supabase module
vi.mock('../lib/supabase', () => ({
  supabase: supabaseMock,
}));