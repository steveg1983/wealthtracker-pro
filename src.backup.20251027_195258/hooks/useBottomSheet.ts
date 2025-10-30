/**
 * Hook for managing bottom sheet state
 */

import { useState, useCallback } from 'react';

export function useBottomSheet(defaultOpen = false) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  return {
    isOpen,
    open,
    close,
    toggle,
    props: {
      isOpen,
      onClose: close
    }
  };
}
