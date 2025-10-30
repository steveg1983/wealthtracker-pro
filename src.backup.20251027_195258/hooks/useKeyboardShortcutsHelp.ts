import { useState, useCallback } from 'react';

export interface KeyboardShortcutsHelpState {
  isOpen: boolean;
  openHelp: () => void;
  closeHelp: () => void;
}

export function useKeyboardShortcutsHelp(): KeyboardShortcutsHelpState {
  const [isOpen, setIsOpen] = useState(false);

  const openHelp = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeHelp = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    openHelp,
    closeHelp,
  };
}

export default useKeyboardShortcutsHelp;
