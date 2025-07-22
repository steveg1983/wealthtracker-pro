/**
 * tagsSlice Tests
 * Comprehensive tests for the tags Redux slice
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import tagsReducer, {
  setTags,
  addTag,
  removeTag,
  addMultipleTags,
  loadTags,
  saveTags,
} from './tagsSlice';
import { storageAdapter } from '../../services/storageAdapter';

// Mock storageAdapter
vi.mock('../../services/storageAdapter', () => ({
  storageAdapter: {
    get: vi.fn(),
    set: vi.fn(),
  }
}));

describe('tagsSlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    
    // Create a fresh store for each test
    store = configureStore({
      reducer: {
        tags: tagsReducer,
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('returns the correct initial state', () => {
      const state = store.getState().tags;
      expect(state).toEqual({
        tags: [],
        loading: false,
        error: null,
      });
    });
  });

  describe('setTags', () => {
    it('sets tags and clears error', () => {
      const tags = ['groceries', 'entertainment', 'utilities'];

      store.dispatch(setTags(tags));

      const state = store.getState().tags;
      expect(state.tags).toEqual(tags);
      expect(state.error).toBeNull();
    });

    it('replaces existing tags', () => {
      const initialTags = ['tag1', 'tag2'];
      const newTags = ['tag3', 'tag4', 'tag5'];

      store.dispatch(setTags(initialTags));
      store.dispatch(setTags(newTags));

      const state = store.getState().tags;
      expect(state.tags).toEqual(newTags);
      expect(state.tags).toHaveLength(3);
    });

    it('handles empty array', () => {
      store.dispatch(setTags(['tag1', 'tag2']));
      store.dispatch(setTags([]));

      const state = store.getState().tags;
      expect(state.tags).toEqual([]);
    });

    it('handles tags with special characters', () => {
      const specialTags = ['#hashtag', '@mention', 'tag-with-dash', 'tag_with_underscore', 'Tag With Spaces'];

      store.dispatch(setTags(specialTags));

      const state = store.getState().tags;
      expect(state.tags).toEqual(specialTags);
    });
  });

  describe('addTag', () => {
    it('adds a new tag', () => {
      store.dispatch(addTag('newtag'));

      const state = store.getState().tags;
      expect(state.tags).toEqual(['newtag']);
    });

    it('does not add duplicate tags', () => {
      store.dispatch(setTags(['existing']));
      store.dispatch(addTag('existing'));

      const state = store.getState().tags;
      expect(state.tags).toEqual(['existing']);
      expect(state.tags).toHaveLength(1);
    });

    it('adds multiple different tags', () => {
      store.dispatch(addTag('tag1'));
      store.dispatch(addTag('tag2'));
      store.dispatch(addTag('tag3'));

      const state = store.getState().tags;
      expect(state.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('maintains tag order', () => {
      const tags = ['apple', 'banana', 'cherry', 'date'];
      
      tags.forEach(tag => store.dispatch(addTag(tag)));

      const state = store.getState().tags;
      expect(state.tags).toEqual(tags);
    });

    it('handles case-sensitive tags', () => {
      store.dispatch(addTag('Tag'));
      store.dispatch(addTag('tag'));
      store.dispatch(addTag('TAG'));

      const state = store.getState().tags;
      expect(state.tags).toEqual(['Tag', 'tag', 'TAG']);
    });

    it('handles empty string tag', () => {
      store.dispatch(addTag(''));

      const state = store.getState().tags;
      expect(state.tags).toEqual(['']);
    });

    it('handles whitespace tags', () => {
      store.dispatch(addTag(' '));
      store.dispatch(addTag('  '));
      store.dispatch(addTag('\t'));

      const state = store.getState().tags;
      expect(state.tags).toEqual([' ', '  ', '\t']);
    });
  });

  describe('removeTag', () => {
    it('removes an existing tag', () => {
      store.dispatch(setTags(['tag1', 'tag2', 'tag3']));
      store.dispatch(removeTag('tag2'));

      const state = store.getState().tags;
      expect(state.tags).toEqual(['tag1', 'tag3']);
    });

    it('does nothing if tag does not exist', () => {
      store.dispatch(setTags(['tag1', 'tag2']));
      store.dispatch(removeTag('nonexistent'));

      const state = store.getState().tags;
      expect(state.tags).toEqual(['tag1', 'tag2']);
    });

    it('handles removing the last tag', () => {
      store.dispatch(setTags(['onlytag']));
      store.dispatch(removeTag('onlytag'));

      const state = store.getState().tags;
      expect(state.tags).toEqual([]);
    });

    it('removes only the exact matching tag', () => {
      store.dispatch(setTags(['tag', 'Tag', 'TAG', 'tag1']));
      store.dispatch(removeTag('tag'));

      const state = store.getState().tags;
      expect(state.tags).toEqual(['Tag', 'TAG', 'tag1']);
    });

    it('handles removing from empty array', () => {
      store.dispatch(removeTag('anything'));

      const state = store.getState().tags;
      expect(state.tags).toEqual([]);
    });

    it('removes all occurrences if duplicates exist', () => {
      // First manually set state with duplicates (shouldn't happen with addTag)
      store.dispatch(setTags(['tag1', 'duplicate', 'tag2', 'duplicate', 'tag3']));
      store.dispatch(removeTag('duplicate'));

      const state = store.getState().tags;
      expect(state.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });
  });

  describe('addMultipleTags', () => {
    it('adds multiple new tags', () => {
      store.dispatch(addMultipleTags(['tag1', 'tag2', 'tag3']));

      const state = store.getState().tags;
      expect(state.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('filters out duplicates when adding', () => {
      store.dispatch(setTags(['existing1', 'existing2']));
      store.dispatch(addMultipleTags(['existing1', 'new1', 'existing2', 'new2']));

      const state = store.getState().tags;
      expect(state.tags).toEqual(['existing1', 'existing2', 'new1', 'new2']);
    });

    it('handles empty array', () => {
      store.dispatch(setTags(['tag1', 'tag2']));
      store.dispatch(addMultipleTags([]));

      const state = store.getState().tags;
      expect(state.tags).toEqual(['tag1', 'tag2']);
    });

    it('handles all duplicates', () => {
      store.dispatch(setTags(['tag1', 'tag2', 'tag3']));
      store.dispatch(addMultipleTags(['tag1', 'tag2', 'tag3']));

      const state = store.getState().tags;
      expect(state.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('maintains order when adding', () => {
      store.dispatch(setTags(['a', 'b']));
      store.dispatch(addMultipleTags(['c', 'd', 'e']));

      const state = store.getState().tags;
      expect(state.tags).toEqual(['a', 'b', 'c', 'd', 'e']);
    });

    it('handles mixed case duplicates correctly', () => {
      store.dispatch(setTags(['Tag']));
      store.dispatch(addMultipleTags(['tag', 'TAG', 'Tag']));

      const state = store.getState().tags;
      expect(state.tags).toEqual(['Tag', 'tag', 'TAG']);
    });

    it('adds tags with special characters', () => {
      store.dispatch(addMultipleTags(['#tag1', '@tag2', 'tag-3', 'tag_4', 'tag 5']));

      const state = store.getState().tags;
      expect(state.tags).toEqual(['#tag1', '@tag2', 'tag-3', 'tag_4', 'tag 5']);
    });
  });

  describe('async thunks', () => {
    describe('loadTags', () => {
      it('loads tags successfully', async () => {
        const mockTags = ['tag1', 'tag2', 'tag3'];

        (storageAdapter.get as any).mockResolvedValue(mockTags);

        await store.dispatch(loadTags());

        const state = store.getState().tags;
        expect(state.loading).toBe(false);
        expect(state.error).toBeNull();
        expect(state.tags).toEqual(mockTags);
        expect(storageAdapter.get).toHaveBeenCalledWith('tags');
      });

      it('handles empty storage', async () => {
        (storageAdapter.get as any).mockResolvedValue(null);

        await store.dispatch(loadTags());

        const state = store.getState().tags;
        expect(state.tags).toEqual([]);
        expect(state.loading).toBe(false);
      });

      it('sets loading state while pending', async () => {
        let resolvePromise: (value: any) => void;
        const promise = new Promise((resolve) => {
          resolvePromise = resolve;
        });
        (storageAdapter.get as any).mockReturnValue(promise);

        const loadPromise = store.dispatch(loadTags());

        // Check loading state immediately
        let state = store.getState().tags;
        expect(state.loading).toBe(true);
        expect(state.error).toBeNull();

        // Resolve and wait
        resolvePromise!([]);
        await loadPromise;

        state = store.getState().tags;
        expect(state.loading).toBe(false);
      });

      it('handles load errors', async () => {
        const errorMessage = 'Storage error';
        (storageAdapter.get as any).mockRejectedValue(new Error(errorMessage));

        await store.dispatch(loadTags());

        const state = store.getState().tags;
        expect(state.loading).toBe(false);
        expect(state.error).toBe(errorMessage);
        expect(state.tags).toEqual([]);
      });

      it('uses default error message if none provided', async () => {
        (storageAdapter.get as any).mockRejectedValue(new Error());

        await store.dispatch(loadTags());

        const state = store.getState().tags;
        expect(state.error).toBe('Failed to load tags');
      });
    });

    describe('saveTags', () => {
      it('saves tags successfully', async () => {
        const tags = ['tag1', 'tag2', 'tag3'];

        (storageAdapter.set as any).mockResolvedValue(undefined);

        await store.dispatch(saveTags(tags));

        expect(storageAdapter.set).toHaveBeenCalledWith('tags', tags);
        
        const state = store.getState().tags;
        expect(state.tags).toEqual(tags);
      });

      it('updates state after saving', async () => {
        const initialTags = ['old1', 'old2'];
        const newTags = ['new1', 'new2', 'new3'];

        store.dispatch(setTags(initialTags));
        
        (storageAdapter.set as any).mockResolvedValue(undefined);
        await store.dispatch(saveTags(newTags));

        const state = store.getState().tags;
        expect(state.tags).toEqual(newTags);
      });

      it('handles save errors gracefully', async () => {
        const tags = ['tag1'];
        (storageAdapter.set as any).mockRejectedValue(new Error('Save failed'));

        // saveTags doesn't have error handling in extraReducers
        // The action will be rejected but won't update the state
        const resultAction = await store.dispatch(saveTags(tags));
        expect(resultAction.type).toMatch(/rejected$/);
      });

      it('saves empty array', async () => {
        (storageAdapter.set as any).mockResolvedValue(undefined);

        await store.dispatch(saveTags([]));

        expect(storageAdapter.set).toHaveBeenCalledWith('tags', []);
        
        const state = store.getState().tags;
        expect(state.tags).toEqual([]);
      });
    });
  });

  describe('reducer behavior', () => {
    it('returns current state for unknown action', () => {
      const initialState = store.getState().tags;
      
      store.dispatch({ type: 'unknown/action' });
      
      const newState = store.getState().tags;
      expect(newState).toEqual(initialState);
    });

    it('maintains immutability', () => {
      const tags = ['tag1', 'tag2'];
      store.dispatch(setTags(tags));
      
      const stateBefore = store.getState().tags;
      const tagsBefore = stateBefore.tags;
      
      store.dispatch(addTag('tag3'));
      
      const stateAfter = store.getState().tags;
      
      // References should be different
      expect(stateAfter).not.toBe(stateBefore);
      expect(stateAfter.tags).not.toBe(tagsBefore);
      
      // Original should be unchanged
      expect(tagsBefore).toEqual(['tag1', 'tag2']);
    });
  });

  describe('edge cases and integration scenarios', () => {
    it('handles very long tag names', () => {
      const longTag = 'a'.repeat(100);
      store.dispatch(addTag(longTag));

      const state = store.getState().tags;
      expect(state.tags).toContain(longTag);
    });

    it('handles unicode and emoji tags', () => {
      const unicodeTags = ['🏷️', '标签', 'тег', 'ετικέτα', '🚀🌟'];
      store.dispatch(setTags(unicodeTags));

      const state = store.getState().tags;
      expect(state.tags).toEqual(unicodeTags);
    });

    it('handles complex tag management flow', () => {
      // Initial tags
      store.dispatch(setTags(['initial1', 'initial2']));
      
      // Add single tag
      store.dispatch(addTag('single'));
      
      // Add multiple tags with some duplicates
      store.dispatch(addMultipleTags(['multi1', 'initial1', 'multi2']));
      
      // Remove a tag
      store.dispatch(removeTag('initial2'));
      
      // Add another tag
      store.dispatch(addTag('final'));

      const state = store.getState().tags;
      expect(state.tags).toEqual(['initial1', 'single', 'multi1', 'multi2', 'final']);
    });
  });
});