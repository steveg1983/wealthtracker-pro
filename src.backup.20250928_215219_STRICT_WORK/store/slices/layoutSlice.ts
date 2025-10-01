import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

interface LayoutState {
  isWideMode: boolean;
}

const initialState: LayoutState = {
  isWideMode: false,
};

const layoutSlice = createSlice({
  name: 'layout',
  initialState,
  reducers: {
    setWideMode: (state, action: PayloadAction<boolean>) => {
      state.isWideMode = action.payload;
    },
    toggleWideMode: (state) => {
      state.isWideMode = !state.isWideMode;
    },
  },
});

export const { setWideMode, toggleWideMode } = layoutSlice.actions;

export default layoutSlice.reducer;
