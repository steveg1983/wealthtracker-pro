import { useCallback, useState } from 'react';

export interface BottomSheetControls {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  props: {
    isOpen: boolean;
    onClose: () => void;
  };
}

export function useBottomSheet(defaultOpen = false): BottomSheetControls {
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
