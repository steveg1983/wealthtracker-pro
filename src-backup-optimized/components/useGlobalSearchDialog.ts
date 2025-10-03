import { useCallback, useState } from 'react';

interface UseGlobalSearchDialogResult {
  isOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
}

export function useGlobalSearchDialog(): UseGlobalSearchDialogResult {
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
