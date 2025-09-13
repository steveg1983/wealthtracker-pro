import React, { useEffect, memo } from 'react';
import { ShieldIcon as Shield } from '../icons';
import { logger } from '../../services/loggingService';

interface BackupStatusIndicatorProps {
  enabled: boolean;
  isOverdue: boolean;
  daysSinceBackup: number | null;
  onClick: () => void;
}

export const BackupStatusIndicator = memo(function BackupStatusIndicator({
  enabled,
  isOverdue,
  daysSinceBackup,
  onClick
}: BackupStatusIndicatorProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('BackupStatusIndicator component initialized', {
      componentName: 'BackupStatusIndicator'
    });
  }, []);

  if (!enabled) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg transition-all hover:scale-105 ${
          isOverdue
            ? 'bg-red-500 text-white'
            : daysSinceBackup === null
            ? 'bg-yellow-500 text-white'
            : 'bg-green-500 text-white'
        }`}
      >
        <Shield size={20} />
        <span className="text-sm font-medium">
          {daysSinceBackup === null
            ? 'No backup yet'
            : isOverdue
            ? 'Backup overdue!'
            : `Backed up ${daysSinceBackup}d ago`}
        </span>
      </button>
    </div>
  );
});
