import React from 'react';

export const useRovingTabIndex = (items: React.RefObject<HTMLElement>[]) => {
  const [focusedIndex, setFocusedIndex] = React.useState(0);

  React.useEffect(() => {
    items.forEach((item, index) => {
      if (item.current) {
        item.current.tabIndex = index === focusedIndex ? 0 : -1;
      }
    });
  }, [focusedIndex, items]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      const { key } = event;
      const lastIndex = items.length - 1;

      switch (key) {
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault();
          setFocusedIndex(prev => (prev === lastIndex ? 0 : prev + 1));
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault();
          setFocusedIndex(prev => (prev === 0 ? lastIndex : prev - 1));
          break;
        case 'Home':
          event.preventDefault();
          setFocusedIndex(0);
          break;
        case 'End':
          event.preventDefault();
          setFocusedIndex(lastIndex);
          break;
        default:
          break;
      }
    },
    [items.length]
  );

  React.useEffect(() => {
    const focusedItem = items[focusedIndex];
    if (focusedItem?.current) {
      focusedItem.current.focus();
    }
  }, [focusedIndex, items]);

  return {
    focusedIndex,
    handleKeyDown,
    setFocusedIndex
  };
};
