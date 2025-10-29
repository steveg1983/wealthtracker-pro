import React, { useState, useCallback } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { enhancedCsvImportService, type ColumnMapping, type ImportProfile, type ImportResult } from '../services/enhancedCsvImportService';
import { 
  UploadIcon, 
  FileTextIcon, 
  CheckIcon, 
  XIcon,
  AlertCircleIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  SaveIcon,
  DownloadIcon,
  RefreshCwIcon
} from './icons';
import { LoadingButton } from './loading/LoadingState';
import { Modal } from './common/Modal';

interface CSVImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'transaction' | 'account';
}

type WizardStep = 'upload' | 'mapping' | 'preview' | 'result';

export default function CSVImportWizard({ isOpen, onClose, type }: CSVImportWizardProps): React.JSX.Element {
  const { accounts, transactions, addTransaction, addAccount, categories } = useApp();
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
  const [csvContent, setCsvContent] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<ImportProfile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showDuplicates, setShowDuplicates] = useState(true);
  const [duplicateThreshold, setDuplicateThreshold] = useState(90);

  // Reset wizard
  const resetWizard = () => {
    setCurrentStep('upload');
    setCsvContent('');
    setHeaders([]);
    setData([]);
    setMappings([]);
    setSelectedProfile(null);
    setImportResult(null);
  };

  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvContent(content);
      
      // Parse CSV
      const parsed = enhancedCsvImportService.parseCSV(content);
      setHeaders(parsed.headers);
      setData(parsed.data);
      
      // Auto-suggest mappings
      const suggestedMappings = enhancedCsvImportService.suggestMappings(parsed.headers, type);
      setMappings(suggestedMappings);
      
      setCurrentStep('mapping');
    };
    reader.readAsText(file);
  }, [type]);

  // Handle drag and drop
  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type === 'text/csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setCsvContent(content);
        
        const parsed = enhancedCsvImportService.parseCSV(content);
        setHeaders(parsed.headers);
        setData(parsed.data);
        
        const suggestedMappings = enhancedCsvImportService.suggestMappings(parsed.headers, type);
        setMappings(suggestedMappings);
        
        setCurrentStep('mapping');
      };
      reader.readAsText(file);
    }
  }, [type]);

  // Update mapping
  const updateMapping = (index: number, field: keyof ColumnMapping, value: string | ((value: string) => string | number | boolean | null)) => {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], [field]: value };
    setMappings(newMappings);
  };

  // Add new mapping
  const addMapping = () => {
    setMappings([...mappings, { sourceColumn: '', targetField: '' }]);
  };

  // Remove mapping
  const removeMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  // Load profile
  const loadProfile = (profile: ImportProfile) => {
    setSelectedProfile(profile);
    setMappings(profile.mappings);
  };

  // Save profile
  const saveProfile = () => {
    const profileName = prompt('Enter a name for this import profile:');
    if (!profileName) return;

    const profile: ImportProfile = {
      id: `profile-${Date.now()}`,
      name: profileName,
      type,
      mappings,
      lastUsed: new Date()
    };

    enhancedCsvImportService.saveProfile(profile);
    setSelectedProfile(profile);
  };

  // Process import
  const processImport = async () => {
    setIsProcessing(true);
    
    try {
      if (type === 'transaction') {
        // Create account map
        const accountMap = new Map(accounts.map(acc => [acc.name, acc.id]));
        
        const result = await enhancedCsvImportService.importTransactions(
          csvContent,
          mappings,
          transactions,
          accountMap,
          {
            skipDuplicates: showDuplicates,
            duplicateThreshold,
            categories: categories || [],
            autoCategorize: true,
            categoryConfidenceThreshold: 0.7
          }
        );
        
        // Add transactions
        for (const item of result.items) {
          // Type guard to check if it's a transaction
          if ('date' in item && 'amount' in item && 'description' in item && 'category' in item && 'accountId' in item && 'type' in item) {
            addTransaction({
              date: item.date as Date,
              amount: item.amount as number,
              description: item.description as string,
              category: item.category as string,
              accountId: item.accountId as string,
              type: item.type as 'income' | 'expense' | 'transfer',
              tags: item.tags,
              notes: item.notes
            });
          }
        }
        
        setImportResult(result);
      } else {
        // Import accounts
        // TODO: Implement account import
      }
      
      setCurrentStep('result');
    } catch (error) {
      console.error('Import error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Target fields for mapping
  const targetFields = type === 'transaction' 
    ? ['date', 'description', 'amount', 'category', 'accountName', 'tags', 'notes', 'balance']
    : ['name', 'type', 'balance', 'currency', 'institution'];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="CSV Import Wizard" size="xl">
      <div className="flex flex-col h-[600px]">
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center space-x-4">
            <StepIndicator 
              label="Upload" 
              isActive={currentStep === 'upload'} 
              isComplete={['mapping', 'preview', 'result'].includes(currentStep)} 
            />
            <ChevronRightIcon size={16} className="text-gray-400" />
            <StepIndicator 
              label="Map Columns" 
              isActive={currentStep === 'mapping'} 
              isComplete={['preview', 'result'].includes(currentStep)} 
            />
            <ChevronRightIcon size={16} className="text-gray-400" />
            <StepIndicator 
              label="Preview" 
              isActive={currentStep === 'preview'} 
              isComplete={currentStep === 'result'} 
            />
            <ChevronRightIcon size={16} className="text-gray-400" />
            <StepIndicator 
              label="Import" 
              isActive={currentStep === 'result'} 
              isComplete={false} 
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto">
          {currentStep === 'upload' && (
            <div className="flex flex-col items-center justify-center h-full p-8">
              <div 
                className="w-full max-w-md p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center hover:border-primary transition-colors cursor-pointer"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <UploadIcon size={48} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Upload CSV File
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Drag and drop your CSV file here, or click to browse
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary cursor-pointer"
                >
                  <FileTextIcon size={20} />
                  Select File
                </label>
              </div>

              {/* Bank Templates */}
              <div className="mt-8 w-full max-w-4xl">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Quick Start with Bank Templates
                </h4>
                
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Select your bank to auto-configure column mappings. Supports 40+ bank formats worldwide.
                </p>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* UK & European Banks */}
                  <div>
                    {/* Major UK Banks */}
                    <div className="mb-4">
                      <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">UK Major Banks</h5>
                      <div className="grid grid-cols-2 gap-2">
                        {['Barclays', 'HSBC', 'Lloyds', 'NatWest', 'Santander', 'Halifax', 'RBS', 'TSB'].map(bank => (
                          <button
                            key={bank}
                            className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-left"
                            onClick={() => {
                              const bankMappings = enhancedCsvImportService.getBankMappings(bank.toLowerCase());
                              setMappings(bankMappings);
                              setCurrentStep('mapping');
                            }}
                          >
                            {bank}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Building Societies */}
                    <div className="mb-4">
                      <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">UK Building Societies</h5>
                      <div className="grid grid-cols-2 gap-2">
                        {['Nationwide', 'Yorkshire', 'Coventry', 'Skipton'].map(bank => (
                          <button
                            key={bank}
                            className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-left"
                            onClick={() => {
                              const bankMappings = enhancedCsvImportService.getBankMappings(bank.toLowerCase());
                              setMappings(bankMappings);
                              setCurrentStep('mapping');
                            }}
                          >
                            {bank}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Digital Banks */}
                    <div className="mb-4">
                      <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Digital Banks</h5>
                      <div className="grid grid-cols-2 gap-2">
                        {['Monzo', 'Starling', 'Revolut', 'Metro'].map(bank => (
                          <button
                            key={bank}
                            className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-left"
                            onClick={() => {
                              const bankMappings = enhancedCsvImportService.getBankMappings(bank.toLowerCase());
                              setMappings(bankMappings);
                              setCurrentStep('mapping');
                            }}
                          >
                            {bank}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Other UK Banks */}
                    <div className="mb-4">
                      <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Other UK Banks</h5>
                      <div className="grid grid-cols-2 gap-2">
                        {['First Direct', 'Co-op', 'Virgin', 'Tesco'].map(bank => (
                          <button
                            key={bank}
                            className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-left"
                            onClick={() => {
                              const bankMappings = enhancedCsvImportService.getBankMappings(bank.toLowerCase().replace(' ', '-'));
                              setMappings(bankMappings);
                              setCurrentStep('mapping');
                            }}
                          >
                            {bank}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* European Banks */}
                    <div className="mb-4">
                      <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">European Banks</h5>
                      <div className="grid grid-cols-2 gap-2">
                        {['Deutsche Bank', 'BNP Paribas', 'ING'].map(bank => (
                          <button
                            key={bank}
                            className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-left"
                            onClick={() => {
                              const bankMappings = enhancedCsvImportService.getBankMappings(bank.toLowerCase().replace(' ', '-'));
                              setMappings(bankMappings);
                              setCurrentStep('mapping');
                            }}
                          >
                            {bank}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {/* International & Online */}
                  <div>
                    {/* US Banks */}
                    <div className="mb-4">
                      <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">US Banks</h5>
                      <div className="grid grid-cols-2 gap-2">
                        {['Chase', 'Bank of America', 'Wells Fargo', 'Citibank', 'TD Bank'].map(bank => (
                          <button
                            key={bank}
                            className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-left"
                            onClick={() => {
                              const bankMappings = enhancedCsvImportService.getBankMappings(bank.toLowerCase().replace(' ', '-'));
                              setMappings(bankMappings);
                              setCurrentStep('mapping');
                            }}
                          >
                            {bank}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Australian Banks */}
                    <div className="mb-4">
                      <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Australian Banks</h5>
                      <div className="grid grid-cols-2 gap-2">
                        {['ANZ', 'Commonwealth', 'Westpac', 'NAB'].map(bank => (
                          <button
                            key={bank}
                            className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-left"
                            onClick={() => {
                              const bankMappings = enhancedCsvImportService.getBankMappings(bank.toLowerCase());
                              setMappings(bankMappings);
                              setCurrentStep('mapping');
                            }}
                          >
                            {bank}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Online Payment Services */}
                    <div className="mb-4">
                      <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Online Payment Services</h5>
                      <div className="grid grid-cols-2 gap-2">
                        {['PayPal', 'Wise', 'Stripe'].map(bank => (
                          <button
                            key={bank}
                            className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-left"
                            onClick={() => {
                              const bankMappings = enhancedCsvImportService.getBankMappings(bank.toLowerCase());
                              setMappings(bankMappings);
                              setCurrentStep('mapping');
                            }}
                          >
                            {bank}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Accounting Software */}
                    <div className="mb-4">
                      <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Accounting Software</h5>
                      <div className="grid grid-cols-2 gap-2">
                        {['QuickBooks', 'Mint', 'Wave'].map(bank => (
                          <button
                            key={bank}
                            className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-left"
                            onClick={() => {
                              const bankMappings = enhancedCsvImportService.getBankMappings(bank.toLowerCase());
                              setMappings(bankMappings);
                              setCurrentStep('mapping');
                            }}
                          >
                            {bank}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'mapping' && (
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Column Mapping
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Map your CSV columns to the appropriate fields
                </p>
              </div>

              {/* Saved Profiles */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Import Profiles
                  </label>
                  <button
                    onClick={saveProfile}
                    className="text-sm text-primary hover:text-secondary transition-colors"
                  >
                    <SaveIcon size={16} className="inline mr-1" />
                    Save Current
                  </button>
                </div>
                <select
                  value={selectedProfile?.id || ''}
                  onChange={(e) => {
                    const profile = enhancedCsvImportService.getProfiles(type)
                      .find(p => p.id === e.target.value);
                    if (profile) loadProfile(profile);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select a saved profile...</option>
                  {enhancedCsvImportService.getProfiles(type).map(profile => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mappings */}
              <div className="space-y-3">
                {mappings.map((mapping, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <select
                      value={mapping.sourceColumn}
                      onChange={(e) => updateMapping(index, 'sourceColumn', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Select CSV column...</option>
                      {headers.map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                    
                    <span className="text-gray-500">→</span>
                    
                    <select
                      value={mapping.targetField}
                      onChange={(e) => updateMapping(index, 'targetField', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Select target field...</option>
                      {targetFields.map(field => (
                        <option key={field} value={field}>{field}</option>
                      ))}
                    </select>
                    
                    <button
                      onClick={() => removeMapping(index)}
                      className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <XIcon size={20} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={addMapping}
                className="mt-4 text-sm text-primary hover:text-secondary transition-colors"
              >
                + Add Mapping
              </button>
            </div>
          )}

          {currentStep === 'preview' && (
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Preview Import
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Review the first few rows to ensure correct mapping
                </p>
              </div>

              {/* Duplicate Detection Settings */}
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showDuplicates}
                      onChange={(e) => setShowDuplicates(e.target.checked)}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Skip duplicate transactions
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600 dark:text-gray-400">
                      Threshold:
                    </label>
                    <input
                      type="number"
                      value={duplicateThreshold}
                      onChange={(e) => setDuplicateThreshold(Number(e.target.value))}
                      min="50"
                      max="100"
                      className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">%</span>
                  </div>
                </div>
              </div>

              {/* Preview Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      {targetFields
                        .filter(field => mappings.some(m => m.targetField === field))
                        .map(field => (
                          <th
                            key={field}
                            className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                          >
                            {field}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                    {data.slice(0, 5).map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {targetFields
                          .filter(field => mappings.some(m => m.targetField === field))
                          .map(field => {
                            const mapping = mappings.find(m => m.targetField === field);
                            const columnIndex = mapping ? headers.indexOf(mapping.sourceColumn || '') : -1;
                            const value = columnIndex >= 0 ? row[columnIndex] : '';
                            
                            return (
                              <td key={field} className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                {mapping?.transform ? mapping.transform(value)?.toString() ?? '' : value}
                              </td>
                            );
                          })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {data.length > 5 && (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Showing 5 of {data.length} rows
                </p>
              )}
            </div>
          )}

          {currentStep === 'result' && importResult && (
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
                  <CheckIcon size={32} className="text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Import Complete!
                </h3>
              </div>

              {/* Results Summary */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {importResult.success}
                  </p>
                  <p className="text-sm text-green-800 dark:text-green-300">Imported</p>
                </div>
                
                {importResult.duplicates > 0 && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                      {importResult.duplicates}
                    </p>
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">Skipped</p>
                  </div>
                )}
                
                {importResult.failed > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                      {importResult.failed}
                    </p>
                    <p className="text-sm text-red-800 dark:text-red-300">Failed</p>
                  </div>
                )}
              </div>

              {/* Errors */}
              {importResult.errors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <h4 className="font-semibold text-red-900 dark:text-red-300 mb-2">
                    Import Errors
                  </h4>
                  <ul className="text-sm text-red-800 dark:text-red-200 space-y-1">
                    {importResult.errors.slice(0, 5).map((error: { row: number; error: string }, index: number) => (
                      <li key={index}>
                        Row {error.row}: {error.error}
                      </li>
                    ))}
                    {importResult.errors.length > 5 && (
                      <li>... and {importResult.errors.length - 5} more errors</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center p-6 border-t border-gray-200 dark:border-gray-600">
          <button
            onClick={currentStep === 'upload' ? onClose : () => {
              const steps: WizardStep[] = ['upload', 'mapping', 'preview', 'result'];
              const currentIndex = steps.indexOf(currentStep);
              if (currentIndex > 0) {
                setCurrentStep(steps[currentIndex - 1]);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            <ChevronLeftIcon size={20} />
            {currentStep === 'upload' ? 'Cancel' : 'Back'}
          </button>

          <div className="flex gap-3">
            {currentStep === 'result' ? (
              <>
                <button
                  onClick={resetWizard}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  <RefreshCwIcon size={20} />
                  Import More
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-secondary"
                >
                  Done
                </button>
              </>
            ) : (
              <LoadingButton
                isLoading={isProcessing}
                onClick={() => {
                  if (currentStep === 'mapping') {
                    setCurrentStep('preview');
                  } else if (currentStep === 'preview') {
                    processImport();
                  }
                }}
                className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-secondary disabled:opacity-50"
                disabled={
                  (currentStep === 'mapping' && mappings.length === 0) ||
                  isProcessing
                }
              >
                {currentStep === 'preview' ? (
                  <>
                    <UploadIcon size={20} />
                    Import
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRightIcon size={20} />
                  </>
                )}
              </LoadingButton>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Step Indicator Component
function StepIndicator({ 
  label, 
  isActive, 
  isComplete 
}: { 
  label: string; 
  isActive: boolean; 
  isComplete: boolean; 
}) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
          isComplete
            ? 'bg-green-500 text-white'
            : isActive
            ? 'bg-primary text-white'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
        }`}
      >
        {isComplete ? <CheckIcon size={20} /> : label.charAt(0)}
      </div>
      <span className={`text-xs mt-1 ${
        isActive ? 'text-primary font-medium' : 'text-gray-500 dark:text-gray-400'
      }`}>
        {label}
      </span>
    </div>
  );
}