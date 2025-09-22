import { useState } from 'react';
import { AriaLiveRegion } from './AriaLiveRegion';

export function useAriaAnnounce() {
  const [announcement, setAnnouncement] = useState('');
  const [liveLevel, setLiveLevel] = useState<'polite' | 'assertive'>('polite');

  const announce = (message: string, level: 'polite' | 'assertive' = 'polite') => {
    setAnnouncement('');
    setLiveLevel(level);

    setTimeout(() => {
      setAnnouncement(message);
    }, 100);
  };

  return {
    announcement,
    announce,
    AriaAnnouncer: () => (
      <AriaLiveRegion message={announcement} level={liveLevel} />
    )
  };
}
