/**
 * Skip Links Component
 * Provides keyboard users quick navigation to main content areas
 */

import React from 'react';

interface SkipLink {
  href: string;
  label: string;
}

interface SkipLinksProps {
  links?: SkipLink[];
}

const defaultLinks: SkipLink[] = [
  { href: '#main-content', label: 'Skip to main content' },
  { href: '#navigation', label: 'Skip to navigation' },
  { href: '#search', label: 'Skip to search' }
];

export const SkipLinks: React.FC<SkipLinksProps> = ({ links = defaultLinks }) => {
  return (
    <nav
      className="skip-links"
      aria-label="Skip links"
    >
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className="skip-link"
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
};

// CSS for skip links (add to your global styles)
export const skipLinksStyles = `
  .skip-links {
    position: absolute;
    top: -40px;
    left: 0;
    background: #000;
    color: #fff;
    padding: 8px;
    text-decoration: none;
    z-index: 100;
  }

  .skip-link {
    position: absolute;
    left: -10000px;
    top: auto;
    width: 1px;
    height: 1px;
    overflow: hidden;
    background: #1a73e8;
    color: white;
    padding: 0.75rem 1.5rem;
    text-decoration: none;
    font-weight: 500;
    border-radius: 0.375rem;
    z-index: 9999;
  }

  .skip-link:focus {
    position: fixed;
    left: 1rem;
    top: 1rem;
    width: auto;
    height: auto;
    overflow: visible;
    outline: 3px solid #4285f4;
    outline-offset: 2px;
  }
`;

// Live Region Component for Screen Reader Announcements
interface LiveRegionProps {
  message: string;
  type?: 'polite' | 'assertive';
  atomic?: boolean;
  relevant?: 'additions' | 'removals' | 'text' | 'all';
}

export const LiveRegion: React.FC<LiveRegionProps> = ({
  message,
  type = 'polite',
  atomic = true,
  relevant = 'additions'
}) => {
  const [currentMessage, setCurrentMessage] = React.useState('');

  React.useEffect(() => {
    if (message) {
      setCurrentMessage(message);
      // Clear message after announcement
      const timer = setTimeout(() => {
        setCurrentMessage('');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  return (
    <div
      role="status"
      aria-live={type}
      aria-atomic={atomic}
      aria-relevant={relevant}
      className="sr-only"
    >
      {currentMessage}
    </div>
  );
};

// Focus Manager Hook
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
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
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

// Roving TabIndex Hook for composite widgets
export const useRovingTabIndex = (items: React.RefObject<HTMLElement>[]) => {
  const [focusedIndex, setFocusedIndex] = React.useState(0);

  React.useEffect(() => {
    items.forEach((item, index) => {
      if (item.current) {
        item.current.tabIndex = index === focusedIndex ? 0 : -1;
      }
    });
  }, [focusedIndex, items]);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    const { key } = e;
    const lastIndex = items.length - 1;

    switch (key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => (prev === lastIndex ? 0 : prev + 1));
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => (prev === 0 ? lastIndex : prev - 1));
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusedIndex(lastIndex);
        break;
    }
  }, [items.length]);

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