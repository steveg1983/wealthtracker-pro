import { useEffect, useState } from 'react';

interface MobileOptimizations {
  isMobile: boolean;
  isSlowConnection: boolean;
  shouldReduceMotion: boolean;
  shouldLazyLoad: boolean;
}

export const useMobileOptimizations = (): MobileOptimizations => {
  const [optimizations, setOptimizations] = useState<MobileOptimizations>({
    isMobile: false,
    isSlowConnection: false,
    shouldReduceMotion: false,
    shouldLazyLoad: false
  });

  useEffect(() => {
    // Check if mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || 
                     window.innerWidth < 768;

    // Check connection speed
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;
    
    const isSlowConnection = connection && (
      connection.effectiveType === 'slow-2g' || 
      connection.effectiveType === '2g' ||
      connection.effectiveType === '3g'
    );

    // Check reduced motion preference
    const shouldReduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Determine if we should lazy load based on device and connection
    const shouldLazyLoad = isMobile || isSlowConnection;

    setOptimizations({
      isMobile,
      isSlowConnection: !!isSlowConnection,
      shouldReduceMotion,
      shouldLazyLoad
    });
  }, []);

  return optimizations;
};

// Hook to defer non-critical operations on mobile
export const useDeferredValue = <T>(value: T, delay: number = 300): T => {
  const [deferredValue, setDeferredValue] = useState(value);
  const { isMobile } = useMobileOptimizations();

  useEffect(() => {
    if (!isMobile) {
      setDeferredValue(value);
      return;
    }

    const timer = setTimeout(() => {
      setDeferredValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay, isMobile]);

  return deferredValue;
};