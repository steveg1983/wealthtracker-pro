import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { activateDemoMode, deactivateDemoMode, selectDemoMode } from '../store/slices/demoSlice';

type UseDemoModeReturn = {
  isDemoMode: boolean;
  activateDemo: () => void;
  deactivateDemo: () => void;
};

export function useDemoMode(): UseDemoModeReturn {
  const dispatch = useAppDispatch();
  const isDemoMode = useAppSelector(selectDemoMode);

  const activateDemo = useCallback(() => {
    dispatch(activateDemoMode());
  }, [dispatch]);

  const deactivateDemo = useCallback(() => {
    dispatch(deactivateDemoMode());
  }, [dispatch]);

  return {
    isDemoMode,
    activateDemo,
    deactivateDemo
  };
}
