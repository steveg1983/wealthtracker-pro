import { memo, useEffect } from 'react';
import { HistoryTable } from './HistoryTable';
import type { RolloverHistory } from './types';
import { useLogger } from '../services/ServiceProvider';

interface RolloverHistoryListProps {
  history: RolloverHistory[];
}

export const RolloverHistoryList = memo(function RolloverHistoryList({ history  }: RolloverHistoryListProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('RolloverHistoryList component initialized', {
      componentName: 'RolloverHistoryList'
    });
  }, []);

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No rollover history available
      </div>
    );
  }

  return <HistoryTable history={history} />;
});