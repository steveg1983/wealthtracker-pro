import { useCallback, useState } from 'react';

export function useKeyboardShortcutsHelp(): {
  isOpen: boolean;
  openHelp: () => void;
  closeHelp: () => void;
} {
  const [isOpen, setIsOpen] = useState(false);

  const openHelp = useCallback(() => setIsOpen(true), []);
  const closeHelp = useCallback(() => setIsOpen(false), []);

  return {
    isOpen,
    openHelp,
    closeHelp,
  };
}
