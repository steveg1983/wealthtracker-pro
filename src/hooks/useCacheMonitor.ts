import { useEffect, useState } from 'react';

export function useCacheMonitor() {
  const [showMonitor, setShowMonitor] = useState(false);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        setShowMonitor(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return {
    showMonitor,
    toggleMonitor: () => setShowMonitor(prev => !prev)
  };
}
