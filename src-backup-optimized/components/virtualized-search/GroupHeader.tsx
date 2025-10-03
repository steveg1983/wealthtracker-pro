import { memo, useEffect } from 'react';
import { 
  FileTextIcon, 
  WalletIcon, 
  FolderIcon, 
  TrendingUpIcon,
  FilterIcon
} from '../icons';
import { VirtualizedSearchService } from '../../services/virtualizedSearchService';
import { useLogger } from '../services/ServiceProvider';

interface GroupHeaderProps {
  type: string;
  count: number;
}

export const GroupHeader = memo(function GroupHeader({ type, count  }: GroupHeaderProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('GroupHeader component initialized', {
      componentName: 'GroupHeader'
    });
  }, []);

  const getIcon = () => {
    const iconColor = VirtualizedSearchService.getIconColor(type);
    switch (type) {
      case 'transaction':
        return <FileTextIcon size={18} className={iconColor} />;
      case 'account':
        return <WalletIcon size={18} className={iconColor} />;
      case 'category':
        return <FolderIcon size={18} className={iconColor} />;
      case 'budget':
      case 'goal':
        return <TrendingUpIcon size={18} className={iconColor} />;
      case 'report':
        return <FilterIcon size={18} className={iconColor} />;
      default:
        return <FileTextIcon size={18} className="text-gray-400" />;
    }
  };

  return (
    <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
      <div className="flex items-center gap-2">
        {getIcon()}
        <span className="font-semibold text-gray-700 dark:text-gray-300">
          {VirtualizedSearchService.getTypeLabel(type, count)}
        </span>
      </div>
    </div>
  );
});