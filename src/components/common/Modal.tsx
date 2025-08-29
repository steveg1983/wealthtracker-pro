import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  ariaDescribedBy?: string;
}

export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  showCloseButton = true,
  ariaDescribedBy
}: ModalProps): React.JSX.Element | null {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  
  useEffect(() => {
    if (isOpen) {
      // Store the currently focused element
      previousActiveElement.current = document.activeElement as HTMLElement;
      
      // Focus the modal after a short delay
      setTimeout(() => {
        modalRef.current?.focus();
      }, 50);
      
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
      
      // Handle escape key
      const handleEscapeKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      
      document.addEventListener('keydown', handleTabKey);
      document.addEventListener('keydown', handleEscapeKey);
      
      // Prevent body scroll when modal is open - simplified approach
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      
      return () => {
        // Cleanup event listeners
        document.removeEventListener('keydown', handleTabKey);
        document.removeEventListener('keydown', handleEscapeKey);
        
        // Restore body scroll
        document.body.style.overflow = originalOverflow;
        
        // Restore focus to the previously focused element
        previousActiveElement.current?.focus();
      };
    }
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full mx-4'
  };

  return (
    <>
      {/* Backdrop with blur and fade animation */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Professional Modal Container - Perfect centering with flexbox */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-8 pointer-events-none">
        <div 
          ref={modalRef}
          className={`
            relative
            bg-white dark:bg-gray-900 
            rounded-2xl 
            shadow-2xl 
            w-full 
            ${sizeClasses[size]}
            max-h-[calc(100vh-2rem)]
            sm:max-h-[calc(100vh-3rem)]
            lg:max-h-[calc(100vh-4rem)]
            flex 
            flex-col
            overflow-hidden
            animate-in zoom-in-95 slide-in-from-bottom-4 duration-300
            border border-gray-200/50 dark:border-gray-700/50
            pointer-events-auto
          `}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          aria-describedby={ariaDescribedBy}
          tabIndex={-1}
        >
          {/* Header - Always visible, never scrolls */}
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
            <h2 
              id="modal-title" 
              className="text-xl font-bold text-gray-900 dark:text-white"
            >
              {title}
            </h2>
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
                <X size={20} />
              </button>
            )}
          </div>
          
          {/* Content area - Scrollable with professional scrollbar styling */}
          <div className="flex-1 overflow-y-auto overscroll-contain 
                          scrollbar-thin scrollbar-track-transparent 
                          scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600
                          hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}

interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalBody({ children, className = '' }: ModalBodyProps): React.JSX.Element {
  return (
    <div className={`px-6 py-5 ${className}`}>
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
    <div className={`flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 ${className}`}>
      {children}
    </div>
  );
}