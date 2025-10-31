import { useCallback, useState } from 'react';

export function useGlobalSearchDialog(): {
  isOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
} {
  const [isOpen, setIsOpen] = useState(false);

  const openSearch = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    openSearch,
    closeSearch,
  };
}
