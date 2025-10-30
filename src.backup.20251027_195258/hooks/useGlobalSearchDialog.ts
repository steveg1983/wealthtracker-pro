import { useState } from 'react';

export function useGlobalSearchDialog(): {
  isOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
} {
  const [isOpen, setIsOpen] = useState(false);

  const openSearch = () => setIsOpen(true);
  const closeSearch = () => setIsOpen(false);

  return {
    isOpen,
    openSearch,
    closeSearch,
  };
}
