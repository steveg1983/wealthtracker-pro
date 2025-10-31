import React from 'react';

export const useAccessibleModal = (defaultOpen = false) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  const openModal = React.useCallback(() => setIsOpen(true), []);
  const closeModal = React.useCallback(() => setIsOpen(false), []);
  const toggleModal = React.useCallback(() => setIsOpen(prev => !prev), []);

  return {
    isOpen,
    openModal,
    closeModal,
    toggleModal,
    modalProps: {
      isOpen,
      onClose: closeModal
    }
  };
};
