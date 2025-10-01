import { useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../index';
import { setWideMode, toggleWideMode } from '../slices/layoutSlice';

// This hook provides the same interface as the existing LayoutContext
export function useLayoutRedux() {
  const dispatch = useAppDispatch();
  
  // Select layout state
  const isWideMode = useAppSelector(state => state.layout.isWideMode);
  
  // Methods that match the LayoutContext interface
  const setWideModeMethod = useCallback((wide: boolean) => {
    dispatch(setWideMode(wide));
  }, [dispatch]);
  
  const toggleWideModeMethod = useCallback(() => {
    dispatch(toggleWideMode());
  }, [dispatch]);
  
  // Return the same interface as LayoutContext
  return useMemo(() => ({
    // State
    isWideMode,
    
    // Methods
    setWideMode: setWideModeMethod,
    toggleWideMode: toggleWideModeMethod
  }), [isWideMode, setWideModeMethod, toggleWideModeMethod]);
}