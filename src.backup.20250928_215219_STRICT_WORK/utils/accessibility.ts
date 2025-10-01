/**
 * Accessibility utility functions and hooks
 */

import { useEffect, useRef } from 'react';

/**
 * Announce a message to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.style.position = 'absolute';
  announcement.style.left = '-10000px';
  announcement.style.width = '1px';
  announcement.style.height = '1px';
  announcement.style.overflow = 'hidden';
  
  announcement.textContent = message;
  document.body.appendChild(announcement);
  
  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Hook to trap focus within an element (e.g., modal, dialog)
 */
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLElement>(null);
  
  useEffect(() => {
    if (!isActive || !containerRef.current) return;
    
    const container = containerRef.current;
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input[type="text"]:not([disabled])',
      'input[type="radio"]:not([disabled])',
      'input[type="checkbox"]:not([disabled])',
      'input[type="number"]:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');
    
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab') return;
      
      const focusableElements = container.querySelectorAll(focusableSelectors);
      if (focusableElements.length === 0) return;
      
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
      
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    // Focus first element when trap is activated
    const focusableElements = container.querySelectorAll(focusableSelectors);
    if (focusableElements.length > 0) {
      (focusableElements[0] as HTMLElement).focus();
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive]);
  
  return containerRef;
}

/**
 * Hook to restore focus to a previous element
 */
export function useFocusRestore(isActive: boolean) {
  const previousFocusRef = useRef<HTMLElement | null>(null);
  
  useEffect(() => {
    if (isActive) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isActive]);
}

/**
 * Generate a unique ID for form elements
 */
export function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get appropriate ARIA label for numeric values
 */
export function getAriaLabelForCurrency(amount: number, currency: string = 'GBP'): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  });
  
  return formatter.format(amount).replace(/[^0-9.,\s-]/g, '').trim() + ' ' + currency;
}

/**
 * Get appropriate ARIA label for dates
 */
export function getAriaLabelForDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Get keyboard navigation instructions for complex components
 */
export function getKeyboardInstructions(componentType: 'table' | 'menu' | 'tabs' | 'dialog'): string {
  const instructions: Record<string, string> = {
    table: 'Use arrow keys to navigate cells, Enter to activate buttons',
    menu: 'Use arrow keys to navigate menu items, Enter or Space to select',
    tabs: 'Use arrow keys to navigate between tabs, Enter or Space to select',
    dialog: 'Press Escape to close, Tab to navigate fields'
  };
  
  return instructions[componentType] || '';
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Create skip link component props
 */
export function createSkipLinkProps(targetId: string, label: string = 'Skip to main content') {
  return {
    href: `#${targetId}`,
    className: 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary text-white px-4 py-2 rounded-lg z-50',
    children: label,
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      const target = document.getElementById(targetId);
      if (target) {
        target.focus();
        target.scrollIntoView();
      }
    }
  };
}