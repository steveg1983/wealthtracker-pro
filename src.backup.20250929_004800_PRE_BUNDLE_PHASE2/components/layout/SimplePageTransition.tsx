import React, { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionStage, setTransitionStage] = useState('fadeIn');

  useEffect(() => {
    setTransitionStage('fadeOut');
    const timer = setTimeout(() => {
      setDisplayChildren(children);
      setTransitionStage('fadeIn');
    }, 200);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  return (
    <div
      className={`page-transition ${transitionStage}`}
      style={{
        opacity: transitionStage === 'fadeIn' ? 1 : 0,
        transform: transitionStage === 'fadeIn' ? 'translateX(0)' : 'translateX(10px)',
        transition: 'opacity 200ms ease-out, transform 200ms ease-out'
      }}
    >
      {displayChildren}
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