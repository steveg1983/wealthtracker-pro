import React, { ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * A short entrance fade on navigation, and NOTHING between navigations.
 *
 * The previous version kept the outgoing page in state and cross-faded on an
 * effect keyed by `children` — but `children` is a fresh ReactNode on every
 * parent render, so ANY re-render of the layout (a notification arriving, a
 * sync dot changing) faded the whole page to opacity 0 for 200ms and slid it
 * 10px sideways. On a phone that read as the screen blinking white while
 * scrolling. It also held a stale snapshot of the page during the window, and
 * added 200ms of deliberate delay to every navigation.
 *
 * Keying the element by pathname gets the same visual (fresh page fades in)
 * from CSS alone: no timers, no stale snapshot, no work at all unless the
 * route actually changed. Reduced-motion users get no animation via the
 * global reduce-motion rules.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-transition animate-pageEnter">
      {children}
    </div>
  );
}

// Navigation progress bar
export function NavigationProgress() {
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);
  const location = useLocation();

  useEffect(() => {
    setIsNavigating(true);
    setProgress(0);
    
    const progressTimer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressTimer);
          return 90;
        }
        return prev + 30;
      });
    }, 100);

    const completeTimer = setTimeout(() => {
      setProgress(100);
      setTimeout(() => {
        setIsNavigating(false);
      }, 200);
    }, 300);

    return () => {
      clearInterval(progressTimer);
      clearTimeout(completeTimer);
    };
  }, [location]);

  if (!isNavigating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700 z-50">
      <div
        className="h-full bg-primary transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
