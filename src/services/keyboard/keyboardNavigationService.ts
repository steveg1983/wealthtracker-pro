/**
 * @module keyboardNavigationService
 * @description Enterprise-grade keyboard navigation service providing focus management,
 * shortcut handling, and accessibility features for world-class keyboard interactions.
 * 
 * @features
 * - Focus trap management
 * - Tab order control
 * - Skip links
 * - Focus restoration
 * - Visual indicators
 * 
 * @accessibility
 * - WCAG 2.1 AA compliant
 * - Screen reader support
 * - Keyboard-only navigation
 */

import { logger } from '../loggingService';

/**
 * Focus management service
 */
class KeyboardNavigationService {
  private static instance: KeyboardNavigationService;
  private focusStack: HTMLElement[] = [];
  private focusTrap: HTMLElement | null = null;
  private lastFocusedElement: HTMLElement | null = null;
  private skipLinkTarget: HTMLElement | null = null;

  private constructor() {
    this.setupFocusIndicator();
    this.setupSkipLinks();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): KeyboardNavigationService {
    if (!KeyboardNavigationService.instance) {
      KeyboardNavigationService.instance = new KeyboardNavigationService();
    }
    return KeyboardNavigationService.instance;
  }

  /**
   * Setup focus indicator styles
   */
  private setupFocusIndicator(): void {
    const style = document.createElement('style');
    style.textContent = `
      .keyboard-focus-visible:focus {
        outline: 2px solid var(--color-primary, #3B82F6);
        outline-offset: 2px;
      }
      
      .keyboard-focus-within:focus-within {
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
      }
      
      .skip-link {
        position: absolute;
        top: -40px;
        left: 0;
        background: var(--color-primary, #3B82F6);
        color: white;
        padding: 8px;
        text-decoration: none;
        z-index: 100000;
      }
      
      .skip-link:focus {
        top: 0;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Setup skip links for accessibility
   */
  private setupSkipLinks(): void {
    const skipLink = document.createElement('a');
    skipLink.href = '#main-content';
    skipLink.className = 'skip-link';
    skipLink.textContent = 'Skip to main content';
    skipLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.focusMain();
    });
    
    document.body.insertBefore(skipLink, document.body.firstChild);
  }

  /**
   * Save current focus
   */
  saveFocus(): void {
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement && activeElement !== document.body) {
      this.lastFocusedElement = activeElement;
      this.focusStack.push(activeElement);
      logger.debug('Focus saved', { element: activeElement.tagName });
    }
  }

  /**
   * Restore previous focus
   */
  restoreFocus(): void {
    if (this.lastFocusedElement) {
      try {
        this.lastFocusedElement.focus();
        logger.debug('Focus restored', { element: this.lastFocusedElement.tagName });
      } catch (error) {
        logger.error('Failed to restore focus', error);
      }
    }
  }

  /**
   * Pop focus from stack
   */
  popFocus(): void {
    const element = this.focusStack.pop();
    if (element) {
      try {
        element.focus();
        this.lastFocusedElement = element;
      } catch (error) {
        logger.error('Failed to pop focus', error);
      }
    }
  }

  /**
   * Create focus trap
   */
  createFocusTrap(container: HTMLElement): void {
    this.focusTrap = container;
    this.saveFocus();

    // Get all focusable elements
    const focusableElements = this.getFocusableElements(container);
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Trap focus
    const trapHandler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', trapHandler);
    container.setAttribute('data-focus-trap', 'true');
    
    // Focus first element
    firstElement.focus();
    
    logger.debug('Focus trap created', { container: container.className });
  }

  /**
   * Release focus trap
   */
  releaseFocusTrap(): void {
    if (this.focusTrap) {
      this.focusTrap.removeAttribute('data-focus-trap');
      this.focusTrap = null;
      this.restoreFocus();
      logger.debug('Focus trap released');
    }
  }

  /**
   * Get focusable elements
   */
  getFocusableElements(container: HTMLElement = document.body): HTMLElement[] {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      'details',
      'summary'
    ].join(',');

    return Array.from(container.querySelectorAll(selector)) as HTMLElement[];
  }

  /**
   * Focus next element
   */
  focusNext(): void {
    const elements = this.getFocusableElements();
    const currentIndex = elements.indexOf(document.activeElement as HTMLElement);
    
    if (currentIndex >= 0 && currentIndex < elements.length - 1) {
      elements[currentIndex + 1].focus();
    } else if (elements.length > 0) {
      elements[0].focus();
    }
  }

  /**
   * Focus previous element
   */
  focusPrevious(): void {
    const elements = this.getFocusableElements();
    const currentIndex = elements.indexOf(document.activeElement as HTMLElement);
    
    if (currentIndex > 0) {
      elements[currentIndex - 1].focus();
    } else if (elements.length > 0) {
      elements[elements.length - 1].focus();
    }
  }

  /**
   * Focus main content
   */
  focusMain(): void {
    const main = document.querySelector('#main-content, main, [role="main"]') as HTMLElement;
    if (main) {
      main.setAttribute('tabindex', '-1');
      main.focus();
      main.removeAttribute('tabindex');
    }
  }

  /**
   * Focus search
   */
  focusSearch(): void {
    const search = document.querySelector(
      'input[type="search"], input[placeholder*="Search"], #search'
    ) as HTMLInputElement;
    if (search) {
      search.focus();
      search.select();
    }
  }

  /**
   * Announce to screen readers
   */
  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
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
    
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }

  /**
   * Set tab order
   */
  setTabOrder(elements: HTMLElement[]): void {
    elements.forEach((element, index) => {
      element.setAttribute('tabindex', String(index));
    });
  }

  /**
   * Reset tab order
   */
  resetTabOrder(container: HTMLElement = document.body): void {
    const elements = container.querySelectorAll('[tabindex]');
    elements.forEach(element => {
      const tabindex = element.getAttribute('tabindex');
      if (tabindex && tabindex !== '-1' && tabindex !== '0') {
        element.removeAttribute('tabindex');
      }
    });
  }

  /**
   * Check if element is focusable
   */
  isFocusable(element: HTMLElement): boolean {
    if (element.hasAttribute('disabled')) return false;
    if (element.getAttribute('tabindex') === '-1') return false;
    
    const focusableTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'DETAILS', 'SUMMARY'];
    if (focusableTags.includes(element.tagName)) return true;
    
    return element.hasAttribute('tabindex');
  }

  /**
   * Make element focusable
   */
  makeFocusable(element: HTMLElement): void {
    if (!this.isFocusable(element)) {
      element.setAttribute('tabindex', '0');
    }
  }

  /**
   * Make element unfocusable
   */
  makeUnfocusable(element: HTMLElement): void {
    element.setAttribute('tabindex', '-1');
  }
}

// Export singleton instance
export const keyboardNavigationService = KeyboardNavigationService.getInstance();