/**
 * @test useOptimisticUpdate
 * @description World-class unit tests for optimistic update hook ensuring
 * reliable instant UI updates with automatic rollback capabilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOptimisticUpdate } from '../useOptimisticUpdate-refactored';
import { optimisticUpdateService } from '../../services/optimistic/optimisticUpdateService';

// Mock the optimistic update service
vi.mock('../../services/optimistic/optimisticUpdateService', () => ({
  optimisticUpdateService: {
    createUpdate: vi.fn(),
    processUpdate: vi.fn(),
    rollback: vi.fn(),
    getPendingUpdates: vi.fn(),
    subscribe: vi.fn()
  }
}));

interface TestEntity {
  id: string;
  name: string;
  value: number;
}

describe('useOptimisticUpdate', () => {
  let unsubscribe: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    unsubscribe = vi.fn();
    vi.mocked(optimisticUpdateService.subscribe).mockReturnValue(unsubscribe);
    vi.mocked(optimisticUpdateService.getPendingUpdates).mockReturnValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => 
        useOptimisticUpdate<TestEntity>()
      );

      expect(result.current.isPending).toBe(false);
      expect(result.current.isProcessing).toBe(false);
      expect(result.current.hasErrors).toBe(false);
      expect(result.current.pendingCount).toBe(0);
      expect(result.current.processingCount).toBe(0);
      expect(result.current.errorCount).toBe(0);
    });

    it('should subscribe to service updates', () => {
      renderHook(() => useOptimisticUpdate<TestEntity>());

      expect(optimisticUpdateService.subscribe).toHaveBeenCalledWith(
        'default',
        expect.any(Function)
      );
    });

    it('should use custom entity type', () => {
      renderHook(() => 
        useOptimisticUpdate<TestEntity>({
          entityType: 'transactions'
        })
      );

      expect(optimisticUpdateService.subscribe).toHaveBeenCalledWith(
        'transactions',
        expect.any(Function)
      );
    });

    it('should unsubscribe on unmount', () => {
      const { unmount } = renderHook(() => 
        useOptimisticUpdate<TestEntity>()
      );

      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe('Optimistic Mutations', () => {
    it('should perform create mutation', async () => {
      const mockData: TestEntity = { 
        id: '1', 
        name: 'Test', 
        value: 100 
      };
      
      const mockApiCall = vi.fn().mockResolvedValue(mockData);
      
      vi.mocked(optimisticUpdateService.createUpdate).mockReturnValue({
        id: '1',
        type: 'create',
        entityType: 'default',
        optimisticData: mockData,
        timestamp: Date.now(),
        status: 'pending',
        retryCount: 0,
        maxRetries: 3
      });

      vi.mocked(optimisticUpdateService.processUpdate).mockResolvedValue({
        success: true,
        data: mockData
      });

      const { result } = renderHook(() => 
        useOptimisticUpdate<TestEntity>()
      );

      let mutationResult;
      await act(async () => {
        mutationResult = await result.current.mutate(
          'create',
          mockData,
          mockApiCall
        );
      });

      expect(optimisticUpdateService.createUpdate).toHaveBeenCalledWith(
        '1',
        'create',
        'default',
        mockData,
        undefined,
        expect.any(Object)
      );

      expect(optimisticUpdateService.processUpdate).toHaveBeenCalledWith(
        '1',
        mockApiCall,
        expect.any(Object)
      );

      expect(mutationResult).toEqual({
        success: true,
        data: mockData
      });
    });

    it('should perform update mutation with original data', async () => {
      const originalData: TestEntity = { 
        id: '1', 
        name: 'Original', 
        value: 50 
      };
      
      const updatedData: TestEntity = { 
        id: '1', 
        name: 'Updated', 
        value: 100 
      };
      
      const mockApiCall = vi.fn().mockResolvedValue(updatedData);
      
      vi.mocked(optimisticUpdateService.processUpdate).mockResolvedValue({
        success: true,
        data: updatedData
      });

      const { result } = renderHook(() => 
        useOptimisticUpdate<TestEntity>()
      );

      await act(async () => {
        await result.current.mutate(
          'update',
          updatedData,
          mockApiCall,
          originalData
        );
      });

      expect(optimisticUpdateService.createUpdate).toHaveBeenCalledWith(
        '1',
        'update',
        'default',
        updatedData,
        originalData,
        expect.any(Object)
      );
    });

    it('should handle delete mutation', async () => {
      const dataToDelete: TestEntity = { 
        id: '1', 
        name: 'Delete Me', 
        value: 0 
      };
      
      const mockApiCall = vi.fn().mockResolvedValue(null);
      
      vi.mocked(optimisticUpdateService.processUpdate).mockResolvedValue({
        success: true,
        data: null
      });

      const { result } = renderHook(() => 
        useOptimisticUpdate<TestEntity>()
      );

      await act(async () => {
        await result.current.mutate(
          'delete',
          null,
          mockApiCall,
          dataToDelete
        );
      });

      expect(optimisticUpdateService.createUpdate).toHaveBeenCalledWith(
        expect.stringContaining('temp-'),
        'delete',
        'default',
        null,
        dataToDelete,
        expect.any(Object)
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle mutation failure', async () => {
      const mockError = new Error('API Error');
      const mockApiCall = vi.fn().mockRejectedValue(mockError);
      const onError = vi.fn();
      
      vi.mocked(optimisticUpdateService.processUpdate).mockResolvedValue({
        success: false,
        error: mockError
      });

      const { result } = renderHook(() => 
        useOptimisticUpdate<TestEntity>({
          onError
        })
      );

      const testData: TestEntity = { 
        id: '1', 
        name: 'Test', 
        value: 100 
      };

      let mutationResult;
      await act(async () => {
        mutationResult = await result.current.mutate(
          'create',
          testData,
          mockApiCall
        );
      });

      expect(mutationResult).toEqual({
        success: false,
        error: mockError
      });

      expect(onError).toHaveBeenCalledWith(mockError, undefined);
    });

    it('should handle rollback', async () => {
      const originalData: TestEntity = { 
        id: '1', 
        name: 'Original', 
        value: 50 
      };

      vi.mocked(optimisticUpdateService.rollback).mockReturnValue({
        success: false,
        data: originalData,
        error: new Error('Update rolled back')
      });

      const onError = vi.fn();

      const { result } = renderHook(() => 
        useOptimisticUpdate<TestEntity>({
          onError
        })
      );

      act(() => {
        result.current.rollback('1');
      });

      expect(optimisticUpdateService.rollback).toHaveBeenCalledWith('1');
      expect(onError).toHaveBeenCalledWith(
        new Error('Update rolled back'),
        originalData
      );
    });

    it('should rollback all pending updates', () => {
      const pendingUpdates = [
        { id: '1', entityType: 'default' },
        { id: '2', entityType: 'default' }
      ];

      vi.mocked(optimisticUpdateService.getPendingUpdates).mockReturnValue(
        pendingUpdates as any
      );

      const { result } = renderHook(() => 
        useOptimisticUpdate<TestEntity>()
      );

      act(() => {
        result.current.rollbackAll();
      });

      expect(optimisticUpdateService.rollback).toHaveBeenCalledTimes(2);
      expect(optimisticUpdateService.rollback).toHaveBeenCalledWith('1');
      expect(optimisticUpdateService.rollback).toHaveBeenCalledWith('2');
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed update', async () => {
      const mockApiCall = vi.fn().mockResolvedValue({ id: '1' });
      
      vi.mocked(optimisticUpdateService.processUpdate).mockResolvedValue({
        success: true,
        data: { id: '1' }
      });

      const { result } = renderHook(() => 
        useOptimisticUpdate<TestEntity>()
      );

      await act(async () => {
        await result.current.retry('1', mockApiCall);
      });

      expect(optimisticUpdateService.processUpdate).toHaveBeenCalledWith(
        '1',
        mockApiCall,
        expect.objectContaining({
          maxRetries: 3,
          retryDelay: 1000
        })
      );
    });

    it('should use custom retry configuration', async () => {
      const mockApiCall = vi.fn().mockResolvedValue({ id: '1' });
      
      const { result } = renderHook(() => 
        useOptimisticUpdate<TestEntity>({
          maxRetries: 5,
          retryDelay: 2000
        })
      );

      await act(async () => {
        await result.current.retry('1', mockApiCall);
      });

      expect(optimisticUpdateService.processUpdate).toHaveBeenCalledWith(
        '1',
        mockApiCall,
        expect.objectContaining({
          maxRetries: 5,
          retryDelay: 2000
        })
      );
    });
  });

  describe('State Updates', () => {
    it('should update state on subscription callback', () => {
      let subscriptionCallback: any;
      
      vi.mocked(optimisticUpdateService.subscribe).mockImplementation(
        (_, callback) => {
          subscriptionCallback = callback;
          return vi.fn();
        }
      );

      const { result } = renderHook(() => 
        useOptimisticUpdate<TestEntity>()
      );

      // Simulate pending update
      act(() => {
        subscriptionCallback({
          id: '1',
          status: 'pending',
          optimisticData: { id: '1' }
        });
      });

      expect(result.current.isPending).toBe(true);
      expect(result.current.pendingCount).toBe(1);

      // Simulate processing update
      act(() => {
        subscriptionCallback({
          id: '1',
          status: 'processing'
        });
      });

      expect(result.current.isProcessing).toBe(true);
      expect(result.current.processingCount).toBe(1);

      // Simulate success
      act(() => {
        subscriptionCallback({
          id: '1',
          status: 'success'
        });
      });

      expect(result.current.isPending).toBe(false);
      expect(result.current.isProcessing).toBe(false);
      expect(result.current.hasErrors).toBe(false);
    });

    it('should handle error state', () => {
      let subscriptionCallback: any;
      
      vi.mocked(optimisticUpdateService.subscribe).mockImplementation(
        (_, callback) => {
          subscriptionCallback = callback;
          return vi.fn();
        }
      );

      const { result } = renderHook(() => 
        useOptimisticUpdate<TestEntity>()
      );

      act(() => {
        subscriptionCallback({
          id: '1',
          status: 'failed',
          error: 'Request failed'
        });
      });

      expect(result.current.hasErrors).toBe(true);
      expect(result.current.errorCount).toBe(1);
      expect(result.current.errors).toHaveLength(1);
      expect(result.current.errors[0]).toEqual({
        id: '1',
        error: new Error('Request failed')
      });
    });

    it('should clear errors', () => {
      let subscriptionCallback: any;
      
      vi.mocked(optimisticUpdateService.subscribe).mockImplementation(
        (_, callback) => {
          subscriptionCallback = callback;
          return vi.fn();
        }
      );

      const { result } = renderHook(() => 
        useOptimisticUpdate<TestEntity>()
      );

      // Add error
      act(() => {
        subscriptionCallback({
          id: '1',
          status: 'failed',
          error: 'Request failed'
        });
      });

      expect(result.current.hasErrors).toBe(true);

      // Clear error
      act(() => {
        result.current.clearError('1');
      });

      expect(result.current.hasErrors).toBe(false);
      expect(result.current.errorCount).toBe(0);
    });
  });

  describe('Success Callback', () => {
    it('should call onSuccess callback', async () => {
      const onSuccess = vi.fn();
      const mockData = { id: '1', name: 'Test', value: 100 };
      const mockApiCall = vi.fn().mockResolvedValue(mockData);
      
      vi.mocked(optimisticUpdateService.processUpdate).mockResolvedValue({
        success: true,
        data: mockData
      });

      const { result } = renderHook(() => 
        useOptimisticUpdate<TestEntity>({
          onSuccess
        })
      );

      await act(async () => {
        await result.current.mutate(
          'create',
          mockData,
          mockApiCall
        );
      });

      expect(onSuccess).toHaveBeenCalledWith(mockData);
    });
  });

  describe('Conflict Resolution', () => {
    it('should use specified conflict strategy', async () => {
      const mockApiCall = vi.fn().mockResolvedValue({ id: '1' });
      
      const { result } = renderHook(() => 
        useOptimisticUpdate<TestEntity>({
          conflictStrategy: 'merge'
        })
      );

      await act(async () => {
        await result.current.mutate(
          'update',
          { id: '1', name: 'Test', value: 100 },
          mockApiCall
        );
      });

      expect(optimisticUpdateService.processUpdate).toHaveBeenCalledWith(
        '1',
        mockApiCall,
        expect.objectContaining({
          conflictStrategy: 'merge'
        })
      );
    });
  });
});