/**
 * Bottom Sheet Service
 * Handles bottom sheet calculations and behaviors
 */

export type SheetHeight = 'auto' | 'full' | 'half' | number;
export type SnapPoint = number; // Percentage from 0-100

export interface SheetDimensions {
  height: number;
  snapHeight?: number;
}

export interface DragState {
  isDragging: boolean;
  offset: number;
  startY: number;
}

class BottomSheetService {
  /**
   * Calculate sheet height based on configuration
   */
  calculateSheetHeight(
    height: 'auto' | 'full' | 'half' | number,
    contentHeight?: number
  ): number {
    if (typeof height === 'number') return height;
    if (height === 'full') return window.innerHeight * 0.95;
    if (height === 'half') return window.innerHeight * 0.5;
    
    // Auto height - use content height with max limit
    if (contentHeight) {
      return Math.min(contentHeight + 100, window.innerHeight * 0.9);
    }
    
    return window.innerHeight * 0.5;
  }

  /**
   * Calculate snap point height
   */
  calculateSnapHeight(snapPoint: number): number {
    return window.innerHeight * (snapPoint / 100);
  }

  /**
   * Get next snap point index based on swipe direction
   */
  getNextSnapIndex(
    currentIndex: number,
    direction: 'up' | 'down',
    totalSnapPoints: number
  ): number | null {
    if (direction === 'up' && currentIndex < totalSnapPoints - 1) {
      return currentIndex + 1;
    }
    if (direction === 'down' && currentIndex > 0) {
      return currentIndex - 1;
    }
    return null;
  }

  /**
   * Determine if drag should trigger close
   */
  shouldCloseOnDrag(dragOffset: number, currentHeight: number): boolean {
    const threshold = Math.min(100, currentHeight * 0.3);
    return dragOffset > threshold;
  }

  /**
   * Get sheet transform styles
   */
  getSheetStyles(
    isOpen: boolean,
    isAnimating: boolean,
    isDragging: boolean,
    dragOffset: number,
    currentHeight: number,
    snapPoints: number[]
  ) {
    const translateY = isOpen && !isAnimating ? dragOffset : isOpen ? 0 : currentHeight;
    
    return {
      transform: `translateY(${translateY}px)`,
      height: snapPoints.length > 0 ? currentHeight : 'auto',
      maxHeight: snapPoints.length === 0 ? '90vh' : undefined,
      transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    };
  }

  /**
   * Get overlay opacity based on state
   */
  getOverlayOpacity(isOpen: boolean, isAnimating: boolean): string {
    return isOpen && !isAnimating ? 'opacity-50' : 'opacity-0';
  }

  /**
   * Handle focus trap for accessibility
   */
  trapFocus(containerElement: HTMLElement): void {
    const focusableElements = containerElement.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length > 0) {
      (focusableElements[0] as HTMLElement).focus();
    }
  }

  /**
   * Lock/unlock body scroll
   */
  setBodyScroll(locked: boolean): void {
    document.body.style.overflow = locked ? 'hidden' : '';
  }

  /**
   * Calculate drag offset with constraints
   */
  calculateDragOffset(currentY: number, startY: number): number {
    const deltaY = currentY - startY;
    return Math.max(0, deltaY); // Only allow dragging down
  }

  /**
   * Check if click/tap is outside element
   */
  isClickOutside(event: MouseEvent | TouchEvent, element: HTMLElement): boolean {
    const target = event.target as HTMLElement;
    return !element.contains(target);
  }

  /**
   * Alias for shouldCloseOnDrag for backward compatibility
   */
  shouldClose(dragOffset: number, currentHeight: number): boolean {
    return this.shouldCloseOnDrag(dragOffset, currentHeight);
  }

  /**
   * Handle swipe gesture
   */
  handleSwipe(deltaY: number, velocity: number): 'close' | 'expand' | 'collapse' | null {
    const threshold = 50;
    const velocityThreshold = 0.5;
    
    if (Math.abs(deltaY) < threshold && Math.abs(velocity) < velocityThreshold) {
      return null;
    }
    
    if (deltaY > threshold || velocity > velocityThreshold) {
      return 'close';
    } else if (deltaY < -threshold || velocity < -velocityThreshold) {
      return 'expand';
    }
    
    return 'collapse';
  }

  /**
   * Setup focus trap for accessibility
   */
  setupFocusTrap(element: HTMLElement): () => void {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0] as HTMLElement;
    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;
    
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };
    
    element.addEventListener('keydown', handleTabKey);
    firstFocusable?.focus();
    
    // Return cleanup function
    return () => {
      element.removeEventListener('keydown', handleTabKey);
    };
  }

  /**
   * Get overlay classes based on state
   */
  getOverlayClasses(isOpen: boolean, isAnimating: boolean): string {
    const baseClasses = 'fixed inset-0 bg-black transition-opacity duration-300';
    const opacityClass = isOpen ? 'bg-opacity-50' : 'bg-opacity-0';
    const pointerClass = isOpen && !isAnimating ? 'pointer-events-auto' : 'pointer-events-none';
    return `${baseClasses} ${opacityClass} ${pointerClass}`;
  }
}

export const bottomSheetService = new BottomSheetService();