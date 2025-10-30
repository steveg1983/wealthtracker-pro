/**
 * Hook for cache monitoring
 */

import { useState } from 'react';

export function useCacheMonitor() {
  const [showMonitor, setShowMonitor] = useState(false);

  return {
    showMonitor,
    toggleMonitor: () => setShowMonitor(prev => !prev)
  };
}
