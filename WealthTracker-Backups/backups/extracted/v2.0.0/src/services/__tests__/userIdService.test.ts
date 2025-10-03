import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { userIdService } from '../userIdService';

// Mock Supabase
vi.mock('../api/supabaseClient', () => ({
  supabase: {
    from: vi.fn()
  },
  isSupabaseConfigured: vi.fn(() => true)
}));

// Mock UserService
vi.mock('../api/userService', () => ({
  UserService: {
    getOrCreateUser: vi.fn()
  }
}));

// Import after mocking
import { supabase } from '../api/supabaseClient';
import { UserService } from '../api/userService';

describe('UserIdService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear cache before each test
    userIdService['cache'].clear();
    userIdService['currentClerkId'] = null;
    userIdService['currentDatabaseId'] = null;
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('getDatabaseUserId', () => {
    it('should fetch database ID from Supabase', async () => {
      const mockClerkId = 'user_2abc123';
      const mockDatabaseId = 'a14bdc0e-2055-45d4-ab86-d86c03309416';

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: mockDatabaseId },
          error: null
        })
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const result = await userIdService.getDatabaseUserId(mockClerkId);

      expect(result).toBe(mockDatabaseId);
      expect(supabase.from).toHaveBeenCalledWith('users');
      expect(mockSupabaseChain.select).toHaveBeenCalledWith('id');
      expect(mockSupabaseChain.eq).toHaveBeenCalledWith('clerk_id', mockClerkId);
    });

    it('should return cached ID if available and not expired', async () => {
      const mockClerkId = 'user_2abc123';
      const mockDatabaseId = 'a14bdc0e-2055-45d4-ab86-d86c03309416';

      // First call - fetch from database
      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: mockDatabaseId },
          error: null
        })
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const result1 = await userIdService.getDatabaseUserId(mockClerkId);
      expect(result1).toBe(mockDatabaseId);

      // Second call - should use cache
      vi.clearAllMocks();
      const result2 = await userIdService.getDatabaseUserId(mockClerkId);
      expect(result2).toBe(mockDatabaseId);
      expect(supabase.from).not.toHaveBeenCalled(); // Should not query database
    });

    it('should refetch if cache is expired', async () => {
      const mockClerkId = 'user_2abc123';
      const mockDatabaseId = 'a14bdc0e-2055-45d4-ab86-d86c03309416';

      // Set up expired cache entry
      userIdService['cache'].set(mockClerkId, {
        clerkId: mockClerkId,
        databaseId: mockDatabaseId,
        timestamp: Date.now() - 6 * 60 * 1000 // 6 minutes ago (expired)
      });

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: mockDatabaseId },
          error: null
        })
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const result = await userIdService.getDatabaseUserId(mockClerkId);

      expect(result).toBe(mockDatabaseId);
      expect(supabase.from).toHaveBeenCalledWith('users'); // Should query database
    });

    it('should return null if user not found', async () => {
      const mockClerkId = 'user_2abc123';

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'User not found' }
        })
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const result = await userIdService.getDatabaseUserId(mockClerkId);

      expect(result).toBeNull();
    });

    it('should return null if Supabase is not configured', async () => {
      // Mock isSupabaseConfigured to return false
      const { isSupabaseConfigured } = await import('../api/supabaseClient');
      vi.mocked(isSupabaseConfigured).mockReturnValueOnce(false);

      const result = await userIdService.getDatabaseUserId('user_2abc123');

      expect(result).toBeNull();
    });
  });

  describe('ensureUserExists', () => {
    it('should create user if not exists', async () => {
      const mockClerkId = 'user_2abc123';
      const mockDatabaseId = 'a14bdc0e-2055-45d4-ab86-d86c03309416';

      // First query - user not found
      const mockSelectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'User not found', code: 'PGRST116' }
        })
      };

      vi.mocked(supabase.from).mockReturnValue(mockSelectChain as any);

      // Mock UserService to create the user
      vi.mocked(UserService.getOrCreateUser).mockResolvedValue({
        id: mockDatabaseId,
        clerk_id: mockClerkId,
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as any);

      const result = await userIdService.ensureUserExists(
        mockClerkId,
        'test@example.com',
        'John',
        'Doe'
      );

      expect(result).toBe(mockDatabaseId);
      expect(UserService.getOrCreateUser).toHaveBeenCalledWith(
        mockClerkId,
        'test@example.com',
        'John',
        'Doe'
      );
    });

    it('should return existing user ID if user exists', async () => {
      const mockClerkId = 'user_2abc123';
      const mockDatabaseId = 'a14bdc0e-2055-45d4-ab86-d86c03309416';

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: mockDatabaseId },
          error: null
        })
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      const result = await userIdService.ensureUserExists(
        mockClerkId,
        'test@example.com'
      );

      expect(result).toBe(mockDatabaseId);
    });
  });

  describe('setCurrentUser', () => {
    it('should set current user IDs', async () => {
      const mockClerkId = 'user_2abc123';
      const mockDatabaseId = 'a14bdc0e-2055-45d4-ab86-d86c03309416';

      await userIdService.setCurrentUser(mockClerkId, mockDatabaseId);

      const ids = userIdService.getCurrentUserIds();
      expect(ids.clerkId).toBe(mockClerkId);
      expect(ids.databaseId).toBe(mockDatabaseId);
    });

    it('should fetch database ID if not provided', async () => {
      const mockClerkId = 'user_2abc123';
      const mockDatabaseId = 'a14bdc0e-2055-45d4-ab86-d86c03309416';

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: mockDatabaseId },
          error: null
        })
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      await userIdService.setCurrentUser(mockClerkId);

      const ids = userIdService.getCurrentUserIds();
      expect(ids.clerkId).toBe(mockClerkId);
      expect(ids.databaseId).toBe(mockDatabaseId);
    });
  });

  describe('getCurrentDatabaseUserId', () => {
    it('should return current database user ID', () => {
      const mockDatabaseId = 'a14bdc0e-2055-45d4-ab86-d86c03309416';
      userIdService.setCurrentUser('user_2abc123', mockDatabaseId);

      const result = userIdService.getCurrentDatabaseUserId();
      expect(result).toBe(mockDatabaseId);
    });

    it('should return null if no current user', () => {
      userIdService.setCurrentUser(null, null);
      const result = userIdService.getCurrentDatabaseUserId();
      expect(result).toBeNull();
    });
  });

  describe('getCurrentUserIds', () => {
    it('should return both current IDs', () => {
      const mockClerkId = 'user_2abc123';
      const mockDatabaseId = 'a14bdc0e-2055-45d4-ab86-d86c03309416';

      userIdService.setCurrentUser(mockClerkId, mockDatabaseId);

      const ids = userIdService.getCurrentUserIds();
      expect(ids).toEqual({
        clerkId: mockClerkId,
        databaseId: mockDatabaseId
      });
    });
  });

  describe('clearCache', () => {
    it('should clear all cached entries', async () => {
      const mockClerkId = 'user_2abc123';
      const mockDatabaseId = 'a14bdc0e-2055-45d4-ab86-d86c03309416';

      // Add to cache
      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: mockDatabaseId },
          error: null
        })
      };

      vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

      await userIdService.getDatabaseUserId(mockClerkId);
      expect(userIdService['cache'].size).toBe(1);

      // Clear cache
      userIdService.clearCache();
      expect(userIdService['cache'].size).toBe(0);

      // Should query database again after cache clear
      await userIdService.getDatabaseUserId(mockClerkId);
      expect(supabase.from).toHaveBeenCalledTimes(2);
    });
  });
});