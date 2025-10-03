import { useState } from 'react';

export function useHelpTooltip(showOnHover = true) {
  const [isVisible, setIsVisible] = useState(false);
  return {
    isVisible,
    show: () => setIsVisible(true),
    hide: () => setIsVisible(false),
    toggle: () => setIsVisible(v => !v),
    showOnHover,
  };
}

export default useHelpTooltip;

