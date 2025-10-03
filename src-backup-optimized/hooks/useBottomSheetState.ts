/**
 * Custom Hook for Bottom Sheet State Management
 * Manages bottom sheet animations, gestures, and state
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { bottomSheetService, SheetHeight, SnapPoint } from '../services/bottomSheetService';

export interface UseBottomSheetStateProps {
  isOpen: boolean;
  onClose: () => void;
  height?: SheetHeight;
  snapPoints?: SnapPoint[];
  defaultSnapPoint?: number;
  closeOnOverlayClick?: boolean;
}

export interface UseBottomSheetStateReturn {
  // State
  isVisible: boolean;
  isAnimating: boolean;
  currentHeight: number;
  isDragging: boolean;
  dragOffset: number;
  currentSnapIndex: number;
  
  // Refs
  sheetRef: React.RefObject<HTMLDivElement>;
  contentRef: React.RefObject<HTMLDivElement>;
  dragHandleRef: React.RefObject<HTMLDivElement>;
  
  // Handlers
  handleTouchStart: (e: React.TouchEvent) => void;
  handleTouchMove: (e: React.TouchEvent) => void;
  handleTouchEnd: () => void;
  handleOverlayClick: () => void;
  handleSwipeDown: () => void;
  handleSwipeUp: () => void;
  
  // Computed
  sheetStyles: React.CSSProperties;
  overlayClasses: string;
}

export function useBottomSheetState({
  isOpen,
  onClose,
  height = 'auto',
  snapPoints = [],
  defaultSnapPoint = 0,
  closeOnOverlayClick = true
}: UseBottomSheetStateProps): UseBottomSheetStateReturn {
  // State
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentHeight, setCurrentHeight] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  
  // Refs
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentSnapIndex = useRef(defaultSnapPoint);
  
  // Calculate sheet height
  const getSheetHeight = useCallback(() => {
    const contentHeight = contentRef.current?.scrollHeight || 0;
    const viewportHeight = window.innerHeight;
    return bottomSheetService.calculateSheetHeight(height, contentHeight);
  }, [height]);
  
  // Snap to point
  const snapToPoint = useCallback((index: number) => {
    if (snapPoints.length === 0) return;
    
    const snapHeight = bottomSheetService.calculateSnapHeight(
      snapPoints[index]
    );
    setCurrentHeight(snapHeight);
    currentSnapIndex.current = index;
  }, [snapPoints]);
  
  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    startY.current = e.touches[0].clientY;
  }, []);
  
  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const deltaY = e.touches[0].clientY - startY.current;
    setDragOffset(Math.max(0, deltaY)); // Only allow dragging down
    
    // Prevent scrolling while dragging
    e.preventDefault();
  }, [isDragging]);
  
  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    
    setIsDragging(false);
    
    if (bottomSheetService.shouldClose(dragOffset, currentHeight)) {
      onClose();
    } else {
      setDragOffset(0);
    }
  }, [isDragging, dragOffset, currentHeight, onClose]);
  
  // Handle overlay click
  const handleOverlayClick = useCallback(() => {
    if (closeOnOverlayClick) {
      onClose();
    }
  }, [closeOnOverlayClick, onClose]);
  
  // Handle swipe gestures
  const handleSwipeDown = useCallback(() => {
    // Simulate swipe down with positive deltaY
    const result = bottomSheetService.handleSwipe(100, 0.6);
    
    if (result === 'close') {
      onClose();
    } else if (result === 'collapse') {
      // Move to lower snap point
      const newIndex = Math.max(0, currentSnapIndex.current - 1);
      snapToPoint(newIndex);
    }
  }, [onClose, snapToPoint]);
  
  const handleSwipeUp = useCallback(() => {
    // Simulate swipe up with negative deltaY
    const result = bottomSheetService.handleSwipe(-100, -0.6);
    
    if (result === 'expand') {
      // Move to higher snap point
      const newIndex = Math.min(snapPoints.length - 1, currentSnapIndex.current + 1);
      snapToPoint(newIndex);
    }
  }, [snapPoints.length, snapToPoint]);
  
  // Handle opening/closing animation
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      setIsVisible(true);
      
      // Calculate initial height
      const initialHeight = getSheetHeight();
      setCurrentHeight(initialHeight);
      
      // Snap to default point if defined
      if (snapPoints.length > 0) {
        snapToPoint(defaultSnapPoint);
      }
      
      // Setup focus trap
      if (sheetRef.current) {
        bottomSheetService.setupFocusTrap(sheetRef.current);
      }
      
      // Prevent body scroll
      bottomSheetService.setBodyScroll(false);
      
      setTimeout(() => setIsAnimating(false), 300);
    } else {
      setIsAnimating(true);
      setTimeout(() => {
        setIsVisible(false);
        setIsAnimating(false);
        setDragOffset(0);
      }, 300);
      
      // Restore body scroll
      bottomSheetService.setBodyScroll(true);
    }
    
    return () => {
      bottomSheetService.setBodyScroll(true);
    };
  }, [isOpen, getSheetHeight, snapPoints, defaultSnapPoint, snapToPoint]);
  
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);
  
  // Get computed styles
  const sheetStyles = bottomSheetService.getSheetStyles(
    isOpen,
    isAnimating,
    isDragging,
    dragOffset,
    currentHeight,
    snapPoints
  );
  
  const overlayClasses = bottomSheetService.getOverlayClasses(isOpen, isAnimating);
  
  return {
    // State
    isVisible,
    isAnimating,
    currentHeight,
    isDragging,
    dragOffset,
    currentSnapIndex: currentSnapIndex.current,
    
    // Refs
    sheetRef,
    contentRef,
    dragHandleRef,
    
    // Handlers
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleOverlayClick,
    handleSwipeDown,
    handleSwipeUp,
    
    // Computed
    sheetStyles,
    overlayClasses
  };
}