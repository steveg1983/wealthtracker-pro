import { useState } from 'react';

export function useKeyboardShortcutsHelp(): {
  isOpen: boolean;
  openHelp: () => void;
  closeHelp: () => void;
} {
  const [isOpen, setIsOpen] = useState(false);
  const openHelp = () => setIsOpen(true);
  const closeHelp = () => setIsOpen(false);
  return { isOpen, openHelp, closeHelp };
}

export default useKeyboardShortcutsHelp;

