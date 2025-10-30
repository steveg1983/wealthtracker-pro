/**
 * ARIA Live Region utilities for screen reader announcements
 */

import React, { useCallback, useMemo, useState } from 'react';
import { AriaLiveRegion } from '../components/common/AriaLiveRegion';

export interface AriaAnnouncerResult {
  announcement: string;
  announce: (message: string) => void;
  AriaAnnouncer: React.FC;
}

/**
 * Hook to manage ARIA live announcements
 * Returns an announcer component that can be rendered in the component tree
 */
export function useAriaAnnounce(): AriaAnnouncerResult {
  const [announcement, setAnnouncement] = useState('');

  const announce = useCallback((message: string): void => {
    setAnnouncement('');

    setTimeout(() => {
      setAnnouncement(message);
    }, 100);
  }, []);

  const AriaAnnouncer = useMemo(() => {
    const Component: React.FC = () => (
      React.createElement(AriaLiveRegion, {
        message: announcement,
        type: 'polite',
      })
    );
    Component.displayName = 'AriaAnnouncer';
    return Component;
  }, [announcement]);

  return {
    announcement,
    announce,
    AriaAnnouncer,
  };
}
