/**
 * Demo Mode Provider - Manages demo mode activation and data isolation
 */

import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { activateDemoMode, deactivateDemoMode, selectDemoMode } from '../store/slices/demoSlice';
import { AlertCircleIcon } from './icons';

interface DemoModeProviderProps {
  children: React.ReactNode;
}

export default function DemoModeProvider({ children }: DemoModeProviderProps): React.JSX.Element {
  const dispatch = useAppDispatch();
  const isDemoMode = useAppSelector(selectDemoMode);

  useEffect(() => {
    // Check URL params for demo mode
    const urlParams = new URLSearchParams(window.location.search);
    const demoParam = urlParams.get('demo');
    
    // Check sessionStorage for persistent demo mode
    const sessionDemo = sessionStorage.getItem('demoMode');
    
    if (demoParam === 'true' || sessionDemo === 'true') {
      if (!isDemoMode) {
        dispatch(activateDemoMode());
      }
    } else if (isDemoMode) {
      dispatch(deactivateDemoMode());
    }
  }, [dispatch, isDemoMode]);

  return (
    <>
      {isDemoMode && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-white px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircleIcon size={16} />
              <span className="text-sm font-medium">
                Demo Mode Active - All data shown is simulated and not saved
              </span>
            </div>
            <button
              onClick={() => {
                dispatch(deactivateDemoMode());
                // Remove demo param from URL
                const url = new URL(window.location.href);
                url.searchParams.delete('demo');
                window.history.replaceState({}, '', url.toString());
              }}
              className="text-xs px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            >
              Exit Demo
            </button>
          </div>
        </div>
      )}
      <div className={isDemoMode ? 'pt-10' : ''}>
        {children}
      </div>
    </>
  );
}

export function useDemoMode() {
  const isDemoMode = useAppSelector(selectDemoMode);
  const dispatch = useAppDispatch();
  
  return {
    isDemoMode,
    activateDemo: () => dispatch(activateDemoMode()),
    deactivateDemo: () => dispatch(deactivateDemoMode())
  };
}