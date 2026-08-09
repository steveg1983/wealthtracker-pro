import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from '../icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  /** Rendered in the header, left of the close button — for a primary action
   *  that must stay visible while the body scrolls (e.g. a batch Save). */
  headerActions?: React.ReactNode;
  showCloseButton?: boolean;
  /**
   * Clicking outside the panel closes the modal (the modern default).
   * Set false for flows that must not be dismissed mid-action (e.g. a
   * destructive import in progress).
   */
  closeOnBackdrop?: boolean;
  ariaDescribedBy?: string;
  /**
   * Accessible name for modals that intentionally render no visible title
   * (e.g. GoalCelebrationModal). Without it a title-less dialog announces only
   * "dialog" to screen readers.
   */
  ariaLabel?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  headerActions,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnBackdrop = true,
  ariaDescribedBy,
  ariaLabel
}: ModalProps): React.JSX.Element | null {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Latest-callback ref: callers routinely pass inline `onClose={() => …}`
  // handlers whose identity changes every render. With onClose in the effect
  // deps, ANY parent re-render (e.g. typing into a search box whose state lives
  // in the caller) re-ran the whole setup — re-taking focus and churning the
  // scroll lock and listeners on every keystroke. Both effects below therefore
  // depend on isOpen ALONE and read the current handler through this ref.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Focus is claimed in the layout phase — before the browser paints the open
  // dialog — so there is no window in which a person can type into a dialog
  // that has not taken focus yet. This used to be a 50ms setTimeout: keystrokes
  // inside that window were swallowed by the non-editable panel div, and the
  // timer fired AFTER a child's autoFocus and yanked the cursor out of it.
  useLayoutEffect(() => {
    if (!isOpen) return;

    const panel = modalRef.current;
    if (!panel) return;

    // Captured here rather than in the passive effect below, which runs after
    // this one: by then the active element would be the panel we just focused,
    // and closing would "restore" focus to a node that no longer exists.
    previousActiveElement.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // React commits a child's autoFocus, and runs a child's own layout effects,
    // before a parent's layout effect — so anything the content chose for
    // itself already holds focus by now. Never take it back off them.
    if (panel.contains(document.activeElement)) return;

    // Markup carrying the real attribute. (React 18 does not reflect its
    // autoFocus PROP to the DOM — it focuses the node itself during commit,
    // which the check above has already honoured.)
    const declared = panel.querySelector('[autofocus]');
    if (declared instanceof HTMLElement) {
      declared.focus();
      return;
    }

    // Nothing claimed it, so the dialog itself takes focus: the keyboard and
    // the screen reader both start inside the thing that just opened.
    panel.focus();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      // Trap focus within modal
      const handleTabKey = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;

        const focusableElements = modalRef.current?.querySelectorAll(
          'a[href], button, textarea, input[type="text"], input[type="number"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])'
        );

        if (!focusableElements || focusableElements.length === 0) return;

        const firstFocusable = focusableElements[0] as HTMLElement;
        const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey && document.activeElement === firstFocusable) {
          lastFocusable.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === lastFocusable) {
          firstFocusable.focus();
          e.preventDefault();
        }
      };

      // Handle escape key (via the ref — see onCloseRef above)
      const handleEscapeKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onCloseRef.current();
        }
      };

      document.addEventListener('keydown', handleTabKey);
      document.addEventListener('keydown', handleEscapeKey);

      // Prevent body scroll when modal is open
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;
      const originalTop = document.body.style.top;
      const originalWidth = document.body.style.width;

      // Store current scroll position
      const scrollY = window.scrollY;

      // Lock body scroll while preserving scroll position
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';

      return () => {
        // Cleanup event listeners
        document.removeEventListener('keydown', handleTabKey);
        document.removeEventListener('keydown', handleEscapeKey);

        // Restore body scroll
        document.body.style.position = originalPosition;
        document.body.style.top = originalTop;
        document.body.style.width = originalWidth;
        document.body.style.overflow = originalOverflow;

        // Restore scroll position
        window.scrollTo(0, scrollY);

        // Restore focus to the previously focused element
        previousActiveElement.current?.focus();
      };
    }
  }, [isOpen]);
  
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-6xl',
    full: 'max-w-full mx-4'
  };

  return createPortal(
    <>
      {/* Backdrop with blur and fade animation */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        aria-hidden="true"
      />

      {/* Modal Container - Top-aligned below search bar. The container covers
          the whole screen ABOVE the backdrop, so outside-clicks land here —
          close only when the click is on the container itself, never on
          anything inside the panel. */}
      <div
        className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-16 pb-6 overflow-y-auto"
        onClick={closeOnBackdrop ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}
      >
        <div
          ref={modalRef}
          className={`
            bg-white dark:bg-gray-900
            rounded-2xl
            shadow-2xl
            w-full
            max-h-[calc(100vh-5.5rem)]
            ${sizeClasses[size]}
            overflow-hidden
            flex
            flex-col
            animate-in zoom-in-95 slide-in-from-bottom-4 duration-200
            border border-gray-200/50 dark:border-gray-700/50
            [&>form]:flex [&>form]:flex-col [&>form]:flex-1 [&>form]:overflow-hidden [&>form]:min-h-0
          `}
          role="dialog"
          aria-modal="true"
          // Only label by the heading when there is a real title; otherwise an
          // empty <h2> would leave the dialog with no accessible name. Title-less
          // callers supply ariaLabel instead.
          aria-labelledby={title ? 'modal-title' : undefined}
          aria-label={!title ? ariaLabel : undefined}
          aria-describedby={ariaDescribedBy}
          tabIndex={-1}
        >
          {/* Header - Always visible */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 flex-shrink-0">
            {title ? (
              <h2
                id="modal-title"
                className="text-xl font-bold text-gray-900 dark:text-white"
              >
                {title}
              </h2>
            ) : (
              <span aria-hidden="true" />
            )}
            <div className="flex items-center gap-2">
            {headerActions}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="
                  p-2
                  rounded-lg
                  text-gray-400
                  hover:text-gray-600
                  dark:text-gray-500
                  dark:hover:text-gray-300
                  hover:bg-gray-100
                  dark:hover:bg-gray-800
                  transition-all
                  duration-200
                  focus:outline-none
                  focus:ring-2
                  focus:ring-primary/50
                "
                aria-label="Close modal"
              >
                <XIcon size={20} />
              </button>
            )}
            </div>
            
          </div>

          {/* Children rendered as direct flex children so ModalFooter stays pinned */}
          {children}
        </div>
      </div>
    </>,
    document.body
  );
}

interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalBody({ children, className = '' }: ModalBodyProps): React.JSX.Element {
  return (
    <div className={`px-6 py-5 flex-1 overflow-y-auto overscroll-contain ${className}`}>
      {children}
    </div>
  );
}

interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalFooter({ children, className = '' }: ModalFooterProps): React.JSX.Element {
  return (
    <div className={`px-6 py-5 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex-shrink-0 ${className}`}>
      {children}
    </div>
  );
}