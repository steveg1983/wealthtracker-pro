import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { XIcon } from './icons';

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  snapPoints?: number[]; // Percentage heights: [0.25, 0.5, 0.9]
  initialSnapPoint?: number;
  showHandle?: boolean;
  closeOnOutsideClick?: boolean;
}

export function MobileBottomSheet({
  isOpen,
  onClose,
  title,
  children,
  snapPoints = [0.9], // Default to 90% height
  initialSnapPoint = 0,
  showHandle = true,
  closeOnOutsideClick = true
}: MobileBottomSheetProps): React.JSX.Element | null {
  const [currentHeight, setCurrentHeight] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startHeight, setStartHeight] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Set initial height based on snap point
      const windowHeight = window.innerHeight;
      const initialHeight = windowHeight * (snapPoints[initialSnapPoint] || 0.5);
      setCurrentHeight(initialHeight);
      
      // Prevent body scroll when bottom sheet is open
      document.body.style.overflow = 'hidden';
      
      // Add escape key handler
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      document.addEventListener('keydown', handleEscape);
      
      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, snapPoints, initialSnapPoint, onClose]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      setStartY(touch.clientY);
      setStartHeight(currentHeight);
      setIsDragging(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    const touch = e.touches[0];
    if (!touch) return;

    const deltaY = startY - touch.clientY;
    const newHeight = Math.max(0, Math.min(window.innerHeight, startHeight + deltaY));
    setCurrentHeight(newHeight);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    
    // Snap to closest snap point
    const windowHeight = window.innerHeight;
    const currentRatio = currentHeight / windowHeight;
    
    // Find closest snap point
    const firstSnapPoint = snapPoints[0];
    if (!firstSnapPoint) return;

    let closestSnapPoint = firstSnapPoint;
    let minDistance = Math.abs(currentRatio - firstSnapPoint);
    
    for (const snapPoint of snapPoints) {
      const distance = Math.abs(currentRatio - snapPoint);
      if (distance < minDistance) {
        minDistance = distance;
        closestSnapPoint = snapPoint;
      }
    }
    
    // If dragged down past 20% of the lowest snap point, close
    if (currentRatio < (snapPoints[0] || 0.5) * 0.2) {
      onClose();
    } else {
      // Animate to snap point
      setCurrentHeight(windowHeight * closestSnapPoint);
    }
  };

  const handleBackdropClick = () => {
    if (closeOnOutsideClick) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />
      
      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl shadow-2xl z-50 transition-transform"
        style={{
          height: `${currentHeight}px`,
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: isDragging ? 'none' : 'transform 0.3s ease-out, height 0.3s ease-out'
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'bottom-sheet-title' : undefined}
      >
        {/* Drag Handle */}
        {showHandle && (
          <div
            className="absolute top-0 left-0 right-0 h-12 cursor-grab active:cursor-grabbing"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="flex justify-center pt-3">
              <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
            </div>
          </div>
        )}
        
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 id="bottom-sheet-title" className="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Close bottom sheet"
            >
              <XIcon size={20} />
            </button>
          </div>
        )}
        
        {/* Content */}
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{
            maxHeight: title 
              ? `calc(${currentHeight}px - ${showHandle ? '3rem' : '0px'} - 4rem)`
              : `calc(${currentHeight}px - ${showHandle ? '3rem' : '0px'})`
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
}
