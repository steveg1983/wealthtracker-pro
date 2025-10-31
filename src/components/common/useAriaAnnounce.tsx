import React from 'react';
import { AriaLiveRegion } from './AriaLiveRegion';

type LiveRegionType = 'polite' | 'assertive';

interface UseAriaAnnounceOptions {
  defaultType?: LiveRegionType;
  announceDelayMs?: number;
}

export const useAriaAnnounce = ({
  defaultType = 'polite',
  announceDelayMs = 100
}: UseAriaAnnounceOptions = {}) => {
  const [announcement, setAnnouncement] = React.useState('');
  const [announcementType, setAnnouncementType] = React.useState<LiveRegionType>(defaultType);
  const timeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const announce = React.useCallback(
    (message: string, type: LiveRegionType = defaultType) => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }

      setAnnouncement('');
      setAnnouncementType(type);

      timeoutRef.current = window.setTimeout(() => {
        setAnnouncement(message);
        timeoutRef.current = null;
      }, announceDelayMs);
    },
    [announceDelayMs, defaultType]
  );

  const AriaAnnouncer = React.useCallback(() => {
    return <AriaLiveRegion message={announcement} type={announcementType} />;
  }, [announcement, announcementType]);

  return {
    announcement,
    announce,
    AriaAnnouncer
  };
};
