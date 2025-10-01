import React, { useEffect, useState } from 'react';

interface AriaLiveRegionProps {
  message: string;
  type?: 'polite' | 'assertive';
  clearAfter?: number;
}

/**
 * Component for announcing messages to screen readers
 * Use for dynamic content updates, form submissions, errors, etc.
 */
export function AriaLiveRegion({ 
  message, 
  type = 'polite',
  clearAfter = 5000 
}: AriaLiveRegionProps): React.JSX.Element {
  const [currentMessage, setCurrentMessage] = useState(message);

  useEffect(() => {
    setCurrentMessage(message);
    
    if (message && clearAfter > 0) {
      const timer = setTimeout(() => {
        setCurrentMessage('');
      }, clearAfter);
      
      return () => clearTimeout(timer);
    }
  }, [message, clearAfter]);

  return (
    <div
      role="status"
      aria-live={type}
      aria-atomic="true"
      className="sr-only"
    >
      {currentMessage}
    </div>
  );
}

/**
 * Hook to manage ARIA live announcements
 */
export function useAriaAnnounce() {
  const [announcement, setAnnouncement] = useState('');
  
  const announce = (message: string, type: 'polite' | 'assertive' = 'polite') => {
    // Clear any existing announcement first
    setAnnouncement('');
    
    // Use setTimeout to ensure the screen reader picks up the change
    setTimeout(() => {
      setAnnouncement(message);
    }, 100);
  };
  
  return {
    announcement,
    announce,
    AriaAnnouncer: () => (
      <AriaLiveRegion message={announcement} type="polite" />
    )
  };
}