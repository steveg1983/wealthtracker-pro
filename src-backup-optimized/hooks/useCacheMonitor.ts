import { useEffect, useState } from 'react';

interface CacheMonitorControls {
  showMonitor: boolean;
  toggleMonitor: () => void;
}

/**
 * Provides keyboard-driven controls for toggling the cache monitor overlay.
 */
export function useCacheMonitor(): CacheMonitorControls {
  const [showMonitor, setShowMonitor] = useState(false);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'C') {
        setShowMonitor((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return {
    showMonitor,
    toggleMonitor: () => setShowMonitor((prev) => !prev)
  };
}
