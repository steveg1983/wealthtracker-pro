import React, { useEffect, memo, lazy, Suspense } from 'react';
import { DownloadIcon, GridIcon } from '../icons';
import { LoadingState } from '../loading/LoadingState';
import type { ModalType } from '../../services/dataManagementService';
import { useLogger } from '../services/ServiceProvider';

const EnhancedExportManager = lazy(() => import('../EnhancedExportManager'));

interface ExportOptionsSectionProps {
  onExportJSON: () => void;
  onOpenModal: (modalType: ModalType) => void;
}

const ExportOptionsSection = memo(function ExportOptionsSection({ onExportJSON,
  onOpenModal
 }: ExportOptionsSectionProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ExportOptionsSection component initialized', {
      componentName: 'ExportOptionsSection'
    });
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Export Options</h3>
      
      {/* Enhanced Export Manager - Full Width */}
      <div className="mb-4">
        <Suspense fallback={<LoadingState />}>
          <EnhancedExportManager />
        </Suspense>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          onClick={onExportJSON}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
        >
          <DownloadIcon size={20} />
          Quick Export (JSON)
        </button>

        <button
          onClick={() => onOpenModal('excelExport')}
          className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
        >
          <GridIcon size={20} />
          Legacy Excel Export
        </button>
      </div>
    </div>
  );
});

export default ExportOptionsSection;