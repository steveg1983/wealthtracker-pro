import { useCallback, useEffect, useState, type RefObject, type KeyboardEvent } from 'react';

export interface RovingTabIndex {
  focusedIndex: number;
  handleKeyDown: (event: KeyboardEvent) => void;
  setFocusedIndex: (index: number) => void;
}

export function useRovingTabIndex(items: RefObject<HTMLElement>[]): RovingTabIndex {
  const [focusedIndex, setFocusedIndex] = useState(0);

  useEffect(() => {
    items.forEach((item, index) => {
      if (item.current) {
        item.current.tabIndex = index === focusedIndex ? 0 : -1;
      }
    });
  }, [focusedIndex, items]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const { key } = event;
    const lastIndex = items.length - 1;

    switch (key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex(previous => (previous === lastIndex ? 0 : previous + 1));
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex(previous => (previous === 0 ? lastIndex : previous - 1));
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
  }, [items.length]);

  useEffect(() => {
    const focusedItem = items[focusedIndex];
    if (focusedItem?.current) {
      focusedItem.current.focus();
    }
  }, [focusedIndex, items]);

  return {
    focusedIndex,
    handleKeyDown,
    setFocusedIndex,
  };
}
