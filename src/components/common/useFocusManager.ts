import React from 'react';

export const useFocusManager = () => {
  const previousFocusRef = React.useRef<HTMLElement | null>(null);

  const saveFocus = React.useCallback(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
  }, []);

  const restoreFocus = React.useCallback(() => {
    if (previousFocusRef.current && previousFocusRef.current.focus) {
      previousFocusRef.current.focus();
    }
  }, []);

  const moveFocusToElement = React.useCallback((element: HTMLElement | null) => {
    if (element && element.focus) {
      element.focus();
    }
  }, []);

  const getFocusableElements = React.useCallback((container: HTMLElement): HTMLElement[] => {
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input[type="text"]:not([disabled])',
      'input[type="radio"]:not([disabled])',
      'input[type="checkbox"]:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(', ');

    return Array.from(container.querySelectorAll(focusableSelectors));
  }, []);

  const trapFocus = React.useCallback((container: HTMLElement) => {
    const focusableElements = getFocusableElements(container);
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') {
        return;
      }

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    };

    document.addEventListener('keydown', handleTabKey);

    return () => {
      document.removeEventListener('keydown', handleTabKey);
    };
  }, [getFocusableElements]);

  return {
    saveFocus,
    restoreFocus,
    moveFocusToElement,
    getFocusableElements,
    trapFocus
  };
};
