import { useState, useCallback } from 'react';

export interface UseAccessibleModalResult {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  toggleModal: () => void;
  modalProps: {
    isOpen: boolean;
    onClose: () => void;
  };
}

export function useAccessibleModal(defaultOpen = false): UseAccessibleModalResult {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const openModal = useCallback(() => setIsOpen(true), []);
  const closeModal = useCallback(() => setIsOpen(false), []);
  const toggleModal = useCallback(() => setIsOpen(prev => !prev), []);

  return {
    isOpen,
    openModal,
    closeModal,
    toggleModal,
    modalProps: {
      isOpen,
      onClose: closeModal,
    },
  };
}
