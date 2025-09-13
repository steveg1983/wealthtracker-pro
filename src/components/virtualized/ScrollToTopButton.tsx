import { memo, useEffect } from 'react';
import { ChevronUpIcon } from '../icons';
import { logger } from '../../services/loggingService';

interface ScrollToTopButtonProps {
  show: boolean;
  onClick: () => void;
}

export const ScrollToTopButton = memo(function ScrollToTopButton({
  show,
  onClick
}: ScrollToTopButtonProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ScrollToTopButton component initialized', {
      componentName: 'ScrollToTopButton'
    });
  }, []);

  if (!show) return <></>;

  return (
    <button
      onClick={onClick}
      className="fixed bottom-20 right-4 z-40 p-3 bg-primary text-white rounded-full shadow-lg hover:bg-secondary transition-all duration-200 transform hover:scale-110"
      aria-label="Scroll to top"
    >
      <ChevronUpIcon size={20} />
    </button>
  );
});