import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import type { Category } from '../../types';
import { storageAdapter } from '../../services/storageAdapter';

interface CategoriesState {
  categories: Category[];
  loading: boolean;
  error: string | null;
}

const initialState: CategoriesState = {
  categories: [],
  loading: false,
  error: null,
};

// Async thunk for loading categories from storage
export const loadCategories = createAsyncThunk(
  'categories/load',
  async () => {
    const categories = await storageAdapter.get<Category[]>('categories') || [];
    return categories;
  }
);

// Async thunk for saving categories to storage
export const saveCategories = createAsyncThunk(
  'categories/save',
  async (categories: Category[]) => {
    await storageAdapter.set('categories', categories);
    return categories;
  }
);

const categoriesSlice = createSlice({
  name: 'categories',
  initialState,
  reducers: {
    setCategories: (state, action: PayloadAction<Category[]>) => {
      state.categories = action.payload;
      state.error = null;
    },
    addCategory: (state, action: PayloadAction<Omit<Category, 'id'>>) => {
      const newCategory: Category = {
        ...action.payload,
        id: crypto.randomUUID(),
      };
      state.categories.push(newCategory);
    },
    updateCategory: (state, action: PayloadAction<{ id: string; updates: Partial<Category> }>) => {
      const index = state.categories.findIndex(c => c.id === action.payload.id);
      if (index !== -1) {
        state.categories[index] = {
          ...state.categories[index],
          ...action.payload.updates,
        };
      }
    },
    deleteCategory: (state, action: PayloadAction<string>) => {
      // Remove the category and update any subcategories to have no parent
      state.categories = state.categories
        .filter(c => c.id !== action.payload)
        .map(c => c.parentId === action.payload ? { ...c, parentId: undefined } : c);
    },
  },
  extraReducers: (builder) => {
    builder
      // Handle loadCategories
      .addCase(loadCategories.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadCategories.fulfilled, (state, action) => {
        state.loading = false;
        state.categories = action.payload;
      })
      .addCase(loadCategories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load categories';
      })
      // Handle saveCategories
      .addCase(saveCategories.fulfilled, (state, action) => {
        state.categories = action.payload;
      });
  },
});

export const {
  setCategories,
  addCategory,
  updateCategory,
  deleteCategory,
} = categoriesSlice.actions;

export default categoriesSlice.reducer;