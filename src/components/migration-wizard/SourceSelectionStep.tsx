import { memo, useEffect } from 'react';
import type { MigrationSource, MigrationSourceConfig } from '../../services/migrationWizardService';
import { logger } from '../../services/loggingService';

interface SourceSelectionStepProps {
  sources: MigrationSourceConfig[];
  selectedSource: MigrationSource | null;
  onSelectSource: (source: MigrationSource) => void;
}

/**
 * Source selection step component
 * Extracted from DataMigrationWizard for single responsibility
 */
export const SourceSelectionStep = memo(function SourceSelectionStep({
  sources,
  selectedSource,
  onSelectSource
}: SourceSelectionStepProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('SourceSelectionStep component initialized', {
      componentName: 'SourceSelectionStep'
    });
  }, []);

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Select Your Data Source
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Choose the application or format you're migrating from
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sources.map(source => {
          const Icon = source.icon;
          return (
            <button
              key={source.id}
              onClick={() => onSelectSource(source.id)}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedSource === source.id
                  ? 'border-gray-500 bg-blue-50 dark:bg-gray-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className={`w-12 h-12 ${source.color} rounded-lg flex items-center justify-center mb-3 mx-auto`}>
                <Icon size={24} className="text-white" />
              </div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                {source.name}
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {source.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
});