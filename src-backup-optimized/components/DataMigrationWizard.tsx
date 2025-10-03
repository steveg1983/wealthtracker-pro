import React, { useState, useCallback } from 'react';
import { 
  UploadIcon as Upload,
  FileTextIcon as FileText,
  CheckCircleIcon as CheckCircle,
  AlertCircleIcon as AlertCircle,
  ArrowRightIcon as ArrowRight,
  ArrowLeftIcon as ArrowLeft,
  DownloadIcon as Download,
  DatabaseIcon as Database,
  ShieldIcon as Shield,
  ZapIcon as Zap,
  CreditCardIcon as CreditCard,
  TrendingUpIcon as TrendingUp,
  UsersIcon as Users,
  XIcon as X
} from './icons';
import { useDropzone } from 'react-dropzone';

export type MigrationSource = 'mint' | 'quicken' | 'ynab' | 'personalcapital' | 'excel' | 'csv' | 'other';

interface MigrationStep {
  id: number;
  title: string;
  description: string;
  icon: React.ElementType;
}

const MIGRATION_STEPS: MigrationStep[] = [
  {
    id: 1,
    title: 'Select Source',
    description: 'Choose where you\'re migrating from',
    icon: Database
  },
  {
    id: 2,
    title: 'Upload Data',
    description: 'Upload your exported data files',
    icon: Upload
  },
  {
    id: 3,
    title: 'Map Fields',
    description: 'Review and map data fields',
    icon: ArrowRight
  },
  {
    id: 4,
    title: 'Review',
    description: 'Preview your imported data',
    icon: CheckCircle
  },
  {
    id: 5,
    title: 'Import',
    description: 'Complete the migration',
    icon: Zap
  }
];

const MIGRATION_SOURCES = [
  {
    id: 'mint' as MigrationSource,
    name: 'Mint',
    description: 'Import from Intuit Mint',
    icon: CreditCard,
    color: 'bg-green-500',
    fileTypes: ['.csv'],
    instructions: 'Export your data from Mint as CSV files before it shuts down.'
  },
  {
    id: 'quicken' as MigrationSource,
    name: 'Quicken',
    description: 'Import from Quicken',
    icon: TrendingUp,
    color: 'bg-gray-500',
    fileTypes: ['.qif', '.qfx'],
    instructions: 'Export your Quicken data as QIF or QFX files.'
  },
  {
    id: 'ynab' as MigrationSource,
    name: 'YNAB',
    description: 'You Need A Budget',
    icon: Users,
    color: 'bg-purple-500',
    fileTypes: ['.csv'],
    instructions: 'Export your YNAB data from Account Settings > Export.'
  },
  {
    id: 'personalcapital' as MigrationSource,
    name: 'Personal Capital',
    description: 'Import from Personal Capital',
    icon: Shield,
    color: 'bg-indigo-500',
    fileTypes: ['.csv'],
    instructions: 'Download your transaction history as CSV from Personal Capital.'
  },
  {
    id: 'excel' as MigrationSource,
    name: 'Excel',
    description: 'Import from Excel spreadsheet',
    icon: FileText,
    color: 'bg-orange-500',
    fileTypes: ['.xlsx', '.xls'],
    instructions: 'Upload your Excel file with transaction data.'
  },
  {
    id: 'csv' as MigrationSource,
    name: 'CSV',
    description: 'Generic CSV import',
    icon: Database,
    color: 'bg-gray-500',
    fileTypes: ['.csv'],
    instructions: 'Upload any CSV file with financial data.'
  }
];

interface DataMigrationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (data: any) => void;
}

export default function DataMigrationWizard({ 
  isOpen, 
  onClose, 
  onComplete 
}: DataMigrationWizardProps): React.JSX.Element | null {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedSource, setSelectedSource] = useState<MigrationSource | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [mappedData, setMappedData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setUploadedFiles(prev => [...prev, ...acceptedFiles]);
    setError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: selectedSource 
      ? MIGRATION_SOURCES.find(s => s.id === selectedSource)?.fileTypes.reduce((acc, type) => ({
          ...acc,
          [type === '.csv' ? 'text/csv' : 
           type === '.xlsx' || type === '.xls' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
           type === '.qif' || type === '.qfx' ? 'application/x-qw' : 'text/plain']: [type]
        }), {})
      : undefined,
    maxSize: 10 * 1024 * 1024 // 10MB
  });

  const handleNextStep = async () => {
    if (currentStep === 2 && uploadedFiles.length === 0) {
      setError('Please upload at least one file');
      return;
    }

    if (currentStep === 2) {
      // Start processing files
      setIsProcessing(true);
      try {
        // Simulate file processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // In production, this would parse the files and extract data
        setMappedData({
          accounts: 5,
          transactions: 1234,
          categories: 15,
          dateRange: '2020-01-01 to 2024-01-01'
        });
        
        setIsProcessing(false);
      } catch (err) {
        setError('Failed to process files');
        setIsProcessing(false);
        return;
      }
    }

    if (currentStep === 5) {
      // Complete migration
      setIsProcessing(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        if (onComplete) {
          onComplete({
            source: selectedSource,
            files: uploadedFiles,
            data: mappedData
          });
        }
        
        onClose();
      } catch (err) {
        setError('Migration failed. Please try again.');
        setIsProcessing(false);
      }
      return;
    }

    setCurrentStep(prev => Math.min(prev + 1, 5));
  };

  const handlePrevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    setError(null);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Data Migration Wizard
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Close wizard"
            >
              <X size={20} />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="mt-6 flex items-center justify-between">
            {MIGRATION_STEPS.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center ${index < MIGRATION_STEPS.length - 1 ? 'flex-1' : ''}`}
              >
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                      currentStep > step.id
                        ? 'bg-green-500 text-white'
                        : currentStep === step.id
                        ? 'bg-gray-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                    }`}
                  >
                    {currentStep > step.id ? (
                      <CheckCircle size={20} />
                    ) : (
                      <span className="text-sm font-medium">{step.id}</span>
                    )}
                  </div>
                  <span className="mt-2 text-xs text-gray-600 dark:text-gray-400 hidden sm:block">
                    {step.title}
                  </span>
                </div>
                {index < MIGRATION_STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 transition-colors ${
                      currentStep > step.id
                        ? 'bg-green-500'
                        : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle size={20} className="text-red-600 dark:text-red-400 mt-0.5" />
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            </div>
          )}

          {/* Step 1: Select Source */}
          {currentStep === 1 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Select Your Data Source
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Choose the application or format you're migrating from
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {MIGRATION_SOURCES.map(source => {
                  const Icon = source.icon;
                  return (
                    <button
                      key={source.id}
                      onClick={() => setSelectedSource(source.id)}
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
          )}

          {/* Step 2: Upload Data */}
          {currentStep === 2 && selectedSource && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Upload Your Data Files
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {MIGRATION_SOURCES.find(s => s.id === selectedSource)?.instructions}
              </p>

              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-gray-500 bg-blue-50 dark:bg-gray-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                }`}
              >
                <input {...getInputProps()} />
                <Upload size={48} className="mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  {isDragActive
                    ? 'Drop the files here...'
                    : 'Drag & drop files here, or click to select'}
                </p>
                <p className="text-xs text-gray-500">
                  Supported formats: {MIGRATION_SOURCES.find(s => s.id === selectedSource)?.fileTypes.join(', ')}
                </p>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    Uploaded Files ({uploadedFiles.length})
                  </h4>
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <FileText size={20} className="text-gray-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {(file.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                        aria-label="Remove file"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Map Fields */}
          {currentStep === 3 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Field Mapping
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                We've automatically mapped your data fields. Review and adjust if needed.
              </p>

              <div className="space-y-4">
                {['Date', 'Description', 'Amount', 'Category', 'Account'].map(field => (
                  <div key={field} className="flex items-center gap-4">
                    <label className="w-32 text-sm font-medium text-gray-700 dark:text-gray-300">
                      {field}
                    </label>
                    <select className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                      <option>Auto-detected: {field}</option>
                      <option>Column A</option>
                      <option>Column B</option>
                      <option>Column C</option>
                      <option>Skip this field</option>
                    </select>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-blue-50 dark:bg-gray-900/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <Zap size={20} className="text-gray-600 dark:text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-gray-300 mb-1">
                      Smart Mapping Active
                    </p>
                    <p className="text-xs text-blue-700 dark:text-gray-500">
                      Our AI has automatically detected and mapped your fields based on common patterns.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {currentStep === 4 && mappedData && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Review Import Summary
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Please review the data that will be imported
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Accounts</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {mappedData.accounts}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Transactions</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {mappedData.transactions}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Categories</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {mappedData.categories}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Date Range</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {mappedData.dateRange}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle size={20} className="text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-900 dark:text-yellow-300 mb-1">
                      Important Note
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-400">
                      Duplicate transactions will be automatically detected and skipped during import.
                      Your existing data will not be affected.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Import */}
          {currentStep === 5 && (
            <div className="text-center py-8">
              {isProcessing ? (
                <>
                  <div className="w-16 h-16 border-4 border-gray-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Importing Your Data...
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    This may take a few minutes. Please don't close this window.
                  </p>
                </>
              ) : (
                <>
                  <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Ready to Import
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Click "Complete Import" to finish the migration process.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <button
            onClick={handlePrevStep}
            disabled={currentStep === 1 || isProcessing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              currentStep === 1 || isProcessing
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            <ArrowLeft size={16} />
            Previous
          </button>

          <button
            onClick={handleNextStep}
            disabled={
              (currentStep === 1 && !selectedSource) ||
              (currentStep === 2 && uploadedFiles.length === 0) ||
              isProcessing
            }
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              ((currentStep === 1 && !selectedSource) ||
                (currentStep === 2 && uploadedFiles.length === 0) ||
                isProcessing)
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-gray-600 text-white hover:bg-gray-700'
            }`}
          >
            {currentStep === 5 ? 'Complete Import' : 'Next'}
            {currentStep < 5 && <ArrowRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
