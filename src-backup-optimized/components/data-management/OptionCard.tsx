import { memo, useEffect } from 'react';
import type { ComponentType } from 'react';
import { useLogger } from '../services/ServiceProvider';
import type { IconProps } from '../icons';
import {
  FileTextIcon,
  UploadIcon,
  DownloadIcon,
  DatabaseIcon,
  FolderIcon,
  SaveIcon,
  RefreshCwIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from '../icons';

interface OptionCardProps {
  title: string;
  description: string;
  icon: string;
  iconColor: string;
  onClick: () => void;
  badge?: string;
  fileType?: string;
}

// Create icon map with commonly used data management icons
const iconMap: Record<string, ComponentType<IconProps>> = {
  FileTextIcon,
  UploadIcon,
  DownloadIcon,
  DatabaseIcon,
  FolderIcon,
  SaveIcon,
  RefreshCwIcon,
  ArrowUpIcon,
  ArrowDownIcon
};

export const OptionCard = memo(function OptionCard({ title,
  description,
  icon,
  iconColor,
  onClick,
  badge,
  fileType
 }: OptionCardProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('OptionCard component initialized', {
      componentName: 'OptionCard'
    });
  }, []);

  const Icon = iconMap[icon] || FileTextIcon;
  
  return (
    <button
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow text-left w-full"
    >
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0`}>
          <Icon size={24} className={iconColor} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {title}
            </h3>
            {badge && (
              <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1 rounded">
                {badge}
              </span>
            )}
            {fileType && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {fileType}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {description}
          </p>
        </div>
      </div>
    </button>
  );
});