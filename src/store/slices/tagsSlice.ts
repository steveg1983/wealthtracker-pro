import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { storageAdapter } from '../../services/storageAdapter';

interface TagsState {
  tags: string[];
  loading: boolean;
  error: string | null;
}

const initialState: TagsState = {
  tags: [],
  loading: false,
  error: null,
};

// Async thunk for loading tags from storage
export const loadTags = createAsyncThunk(
  'tags/load',
  async () => {
    const tags = await storageAdapter.get<string[]>('tags') || [];
    return tags;
  }
);

// Async thunk for saving tags to storage
export const saveTags = createAsyncThunk(
  'tags/save',
  async (tags: string[]) => {
    await storageAdapter.set('tags', tags);
    return tags;
  }
);

const tagsSlice = createSlice({
  name: 'tags',
  initialState,
  reducers: {
    setTags: (state, action: PayloadAction<string[]>) => {
      state.tags = action.payload;
      state.error = null;
    },
    addTag: (state, action: PayloadAction<string>) => {
      if (!state.tags.includes(action.payload)) {
        state.tags.push(action.payload);
      }
    },
    removeTag: (state, action: PayloadAction<string>) => {
      state.tags = state.tags.filter(tag => tag !== action.payload);
    },
    addMultipleTags: (state, action: PayloadAction<string[]>) => {
      const newTags = action.payload.filter(tag => !state.tags.includes(tag));
      state.tags.push(...newTags);
    },
  },
  extraReducers: (builder) => {
    builder
      // Handle loadTags
      .addCase(loadTags.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadTags.fulfilled, (state, action) => {
        state.loading = false;
        state.tags = action.payload;
      })
      .addCase(loadTags.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load tags';
      })
      // Handle saveTags
      .addCase(saveTags.fulfilled, (state, action) => {
        state.tags = action.payload;
      });
  },
});

export const {
  setTags,
  addTag,
  removeTag,
  addMultipleTags,
} = tagsSlice.actions;

export default tagsSlice.reducer;