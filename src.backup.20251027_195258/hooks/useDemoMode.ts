/**
 * Demo Mode Hook
 */

import { useAppDispatch, useAppSelector } from '../store';
import { activateDemoMode, deactivateDemoMode, selectDemoMode } from '../store/slices/demoSlice';

export function useDemoMode() {
  const isDemoMode = useAppSelector(selectDemoMode);
  const dispatch = useAppDispatch();

  return {
    isDemoMode,
    activateDemo: () => dispatch(activateDemoMode()),
    deactivateDemo: () => dispatch(deactivateDemoMode())
  };
}
