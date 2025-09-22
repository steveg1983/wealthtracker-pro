import { memo, useEffect } from 'react';
import { useLogger } from '../services/ServiceProvider';
import { 
  UploadIcon, 
  FileTextIcon, 
  CreditCardIcon,
  DatabaseIcon,
  MagicWandIcon 
} from '../icons';

interface ImportTabProps {
  onOpenCsvWizard: (type: 'transaction' | 'account') => void;
  onOpenOfxModal: () => void;
}

/**
 * Import tab component
 * Shows import options and features
 */
export const ImportTab = memo(function ImportTab({ onOpenCsvWizard,
  onOpenOfxModal
 }: ImportTabProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ImportTab component initialized', {
      componentName: 'ImportTab'
    });
  }, []);

  return (
    <div className="space-y-6">
      {/* Import Options */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Import Data
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Choose what type of data you want to import
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ImportOption
            icon={FileTextIcon}
            title="CSV Import"
            description="Import from bank CSV exports with smart column mapping"
            buttonText="Import CSV"
            color="primary"
            onClick={() => onOpenCsvWizard('transaction')}
          />

          <ImportOption
            icon={CreditCardIcon}
            title="OFX Import"
            description="Import OFX files with automatic account matching"
            buttonText="Import OFX"
            color="tertiary"
            onClick={onOpenOfxModal}
          />

          <ImportOption
            icon={DatabaseIcon}
            title="Import Accounts"
            description="Import account information from CSV files"
            buttonText="Import CSV"
            color="secondary"
            onClick={() => onOpenCsvWizard('account')}
          />
        </div>
      </div>

      {/* Features */}
      <ImportFeatures />
    </div>
  );
});

/**
 * Import option card component
 */
const ImportOption = memo(function ImportOption({
  icon: Icon,
  title,
  description,
  buttonText,
  color,
  onClick
}: {
  icon: any;
  title: string;
  description: string;
  buttonText: string;
  color: 'primary' | 'secondary' | 'tertiary';
  onClick: () => void;
}) {
  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-6 hover:border-[var(--color-primary)] transition-colors">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-12 h-12 bg-[var(--color-${color})]/10 rounded-full flex items-center justify-center`}>
          <Icon className={`text-[var(--color-${color})]`} size={24} />
        </div>
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h4>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {description}
      </p>
      <button
        onClick={onClick}
        className={`w-full flex items-center justify-center gap-2 px-4 py-2 bg-[var(--color-${color})] text-white rounded-lg hover:bg-[var(--color-${color})]/90`}
      >
        <UploadIcon size={16} />
        {buttonText}
      </button>
    </div>
  );
});

/**
 * Import features component
 */
const ImportFeatures = memo(function ImportFeatures() {
  const features = [
    {
      title: 'CSV: Intelligent Mapping',
      description: 'Automatically detects and maps columns from your CSV files to the appropriate fields'
    },
    {
      title: 'OFX: Automatic Account Matching',
      description: 'Matches OFX files to your accounts using account numbers and sort codes'
    },
    {
      title: 'Bank Templates',
      description: 'Pre-configured templates for 20+ UK banks and building societies'
    },
    {
      title: 'Duplicate Prevention',
      description: 'Uses transaction IDs and smart matching to prevent duplicate imports'
    }
  ];

  return (
    <div className="bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-secondary)]/10 dark:from-[var(--color-primary)]/20 dark:to-[var(--color-secondary)]/20 rounded-2xl p-6">
      <div className="flex items-start gap-4">
        <MagicWandIcon className="text-[var(--color-primary)] mt-1" size={24} />
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Smart Import Features
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400">
            {features.map(feature => (
              <div key={feature.title}>
                <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-1">
                  {feature.title}
                </h4>
                <p>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});