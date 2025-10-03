import React, { useState, useMemo } from 'react';
import { enhancedCsvImportService } from '../services/enhancedCsvImportService';
import { 
  SearchIcon, 
  CheckIcon, 
  GlobeIcon, 
  Building2Icon as BankIcon, 
  CreditCardIcon,
  LineChartIcon,
  DollarSignIcon as BitcoinIcon,
  BriefcaseIcon,
  SettingsIcon
} from './icons';

interface BankFormatSelectorProps {
  onBankSelected: (bankKey: string, bankName: string) => void;
  selectedBank?: string;
  className?: string;
}

interface BankFormat {
  key: string;
  name: string;
  region: string;
  type: 'traditional' | 'digital' | 'investment' | 'crypto' | 'business' | 'payment';
  logo?: string;
}

const BANK_FORMATS: BankFormat[] = [
  // UK Banks - Traditional
  { key: 'barclays', name: 'Barclays', region: 'UK', type: 'traditional' },
  { key: 'hsbc', name: 'HSBC', region: 'UK', type: 'traditional' },
  { key: 'lloyds', name: 'Lloyds Bank', region: 'UK', type: 'traditional' },
  { key: 'natwest', name: 'NatWest', region: 'UK', type: 'traditional' },
  { key: 'santander', name: 'Santander UK', region: 'UK', type: 'traditional' },
  { key: 'tsb', name: 'TSB Bank', region: 'UK', type: 'traditional' },
  { key: 'halifax', name: 'Halifax', region: 'UK', type: 'traditional' },
  { key: 'nationwide', name: 'Nationwide', region: 'UK', type: 'traditional' },
  { key: 'first-direct', name: 'First Direct', region: 'UK', type: 'traditional' },
  
  // UK Banks - Digital
  { key: 'monzo', name: 'Monzo', region: 'UK', type: 'digital' },
  { key: 'starling', name: 'Starling Bank', region: 'UK', type: 'digital' },
  { key: 'revolut', name: 'Revolut', region: 'UK', type: 'digital' },
  { key: 'n26', name: 'N26', region: 'EU', type: 'digital' },
  
  // US Banks
  { key: 'chase', name: 'Chase Bank', region: 'US', type: 'traditional' },
  { key: 'bank-of-america', name: 'Bank of America', region: 'US', type: 'traditional' },
  { key: 'wells-fargo', name: 'Wells Fargo', region: 'US', type: 'traditional' },
  { key: 'citibank', name: 'Citibank', region: 'US', type: 'traditional' },
  { key: 'td-bank', name: 'TD Bank', region: 'US', type: 'traditional' },
  
  // European Banks
  { key: 'deutsche-bank', name: 'Deutsche Bank', region: 'EU', type: 'traditional' },
  { key: 'bnp-paribas', name: 'BNP Paribas', region: 'EU', type: 'traditional' },
  { key: 'credit-agricole', name: 'Crédit Agricole', region: 'EU', type: 'traditional' },
  { key: 'societe-generale', name: 'Société Générale', region: 'EU', type: 'traditional' },
  { key: 'ing-bank', name: 'ING Bank', region: 'EU', type: 'traditional' },
  { key: 'abn-amro', name: 'ABN AMRO', region: 'EU', type: 'traditional' },
  { key: 'rabobank', name: 'Rabobank', region: 'EU', type: 'traditional' },
  { key: 'unicredit', name: 'UniCredit', region: 'EU', type: 'traditional' },
  { key: 'intesa-sanpaolo', name: 'Intesa Sanpaolo', region: 'EU', type: 'traditional' },
  
  // Asian Banks
  { key: 'dbs-bank', name: 'DBS Bank', region: 'Asia', type: 'traditional' },
  { key: 'ocbc-bank', name: 'OCBC Bank', region: 'Asia', type: 'traditional' },
  { key: 'uob-bank', name: 'UOB Bank', region: 'Asia', type: 'traditional' },
  { key: 'icbc', name: 'ICBC', region: 'Asia', type: 'traditional' },
  { key: 'hsbc-asia', name: 'HSBC Asia', region: 'Asia', type: 'traditional' },
  
  // Canadian Banks
  { key: 'rbc-royal-bank', name: 'RBC Royal Bank', region: 'Canada', type: 'traditional' },
  { key: 'td-canada-trust', name: 'TD Canada Trust', region: 'Canada', type: 'traditional' },
  { key: 'scotiabank', name: 'Scotiabank', region: 'Canada', type: 'traditional' },
  { key: 'bmo-bank-of-montreal', name: 'BMO Bank of Montreal', region: 'Canada', type: 'traditional' },
  
  // Australian Banks
  { key: 'commonwealth-bank', name: 'Commonwealth Bank', region: 'Australia', type: 'traditional' },
  { key: 'westpac', name: 'Westpac', region: 'Australia', type: 'traditional' },
  { key: 'anz-bank', name: 'ANZ Bank', region: 'Australia', type: 'traditional' },
  { key: 'nab-bank', name: 'NAB Bank', region: 'Australia', type: 'traditional' },
  
  // Crypto Exchanges
  { key: 'coinbase', name: 'Coinbase', region: 'Global', type: 'crypto' },
  { key: 'binance', name: 'Binance', region: 'Global', type: 'crypto' },
  { key: 'kraken', name: 'Kraken', region: 'Global', type: 'crypto' },
  
  // Investment Platforms
  { key: 'vanguard', name: 'Vanguard', region: 'Global', type: 'investment' },
  { key: 'fidelity', name: 'Fidelity', region: 'Global', type: 'investment' },
  { key: 'charles-schwab', name: 'Charles Schwab', region: 'US', type: 'investment' },
  { key: 'etrade', name: 'E*TRADE', region: 'US', type: 'investment' },
  
  // Payment Services
  { key: 'paypal', name: 'PayPal', region: 'Global', type: 'payment' },
  { key: 'stripe', name: 'Stripe', region: 'Global', type: 'payment' },
  { key: 'square', name: 'Square', region: 'Global', type: 'payment' },
  
  // Business Software
  { key: 'quickbooks', name: 'QuickBooks', region: 'Global', type: 'business' },
  { key: 'xero', name: 'Xero', region: 'Global', type: 'business' },
  { key: 'mint', name: 'Mint', region: 'US', type: 'business' },
  { key: 'ynab', name: 'YNAB', region: 'Global', type: 'business' },
];

const REGION_GROUPS: Record<string, string> = {
  'UK': 'United Kingdom',
  'US': 'United States',
  'EU': 'Europe',
  'Canada': 'Canada',
  'Australia': 'Australia',
  'Asia': 'Asia Pacific',
  'Global': 'Global Services'
};

const TYPE_GROUPS: Record<string, string> = {
  'traditional': 'Traditional Banks',
  'digital': 'Digital Banks',
  'investment': 'Investment Platforms',
  'crypto': 'Cryptocurrency',
  'payment': 'Payment Services',
  'business': 'Business Software'
};

const TYPE_ICONS = {
  'traditional': BankIcon,
  'digital': CreditCardIcon,
  'investment': LineChartIcon,
  'crypto': BitcoinIcon,
  'payment': CreditCardIcon,
  'business': BriefcaseIcon
};

export default function BankFormatSelector({ onBankSelected, selectedBank, className }: BankFormatSelectorProps): React.JSX.Element {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredBanks = useMemo(() => {
    return BANK_FORMATS.filter(bank => {
      const matchesSearch = searchTerm === '' || 
        bank.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bank.key.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRegion = selectedRegion === 'all' || bank.region === selectedRegion;
      const matchesType = selectedType === 'all' || bank.type === selectedType;
      
      return matchesSearch && matchesRegion && matchesType;
    });
  }, [searchTerm, selectedRegion, selectedType]);

  const groupedBanks = useMemo(() => {
    const groups: Record<string, BankFormat[]> = {};
    
    filteredBanks.forEach(bank => {
      const groupKey = selectedRegion !== 'all' ? bank.type : bank.region;
      const groupName = selectedRegion !== 'all' ? TYPE_GROUPS[bank.type] : REGION_GROUPS[bank.region];
      
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(bank);
    });
    
    return groups;
  }, [filteredBanks, selectedRegion]);

  const handleBankSelect = (bank: BankFormat): void => {
    onBankSelected(bank.key, bank.name);
  };

  return (
    <div className={`bank-format-selector ${className || ''}`}>
      {/* Search and Filters */}
      <div className="space-y-4 mb-6">
        {/* Search */}
        <div className="relative">
          <SearchIcon size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search banks, payment services, or investment platforms..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <GlobeIcon size={16} className="text-gray-500" />
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="all">All Regions</option>
              {Object.entries(REGION_GROUPS).map(([key, name]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <BankIcon size={16} className="text-gray-500" />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="all">All Types</option>
              {Object.entries(TYPE_GROUPS).map(([key, name]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-6">
        {Object.entries(groupedBanks).map(([groupName, banks]) => (
          <div key={groupName}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              {groupName} ({banks.length})
            </h3>
            
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {banks.map(bank => {
                  const isSelected = selectedBank === bank.key;
                  return (
                    <button
                      key={bank.key}
                      onClick={() => handleBankSelect(bank)}
                      className={`p-4 rounded-lg border-2 text-left transition-all hover:shadow-md ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                            {bank.name}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {bank.region} • {TYPE_GROUPS[bank.type]}
                          </p>
                        </div>
                        {isSelected && (
                          <CheckIcon size={16} className="text-blue-500 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {banks.map(bank => {
                  const isSelected = selectedBank === bank.key;
                  return (
                    <button
                      key={bank.key}
                      onClick={() => handleBankSelect(bank)}
                      className={`w-full p-3 rounded-lg border text-left transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {bank.name}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {bank.region} • {TYPE_GROUPS[bank.type]}
                        </p>
                      </div>
                      {isSelected && (
                        <CheckIcon size={20} className="text-blue-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        
        {filteredBanks.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              No banks found matching your search criteria.
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedRegion('all');
                setSelectedType('all');
              }}
              className="mt-2 text-blue-500 hover:text-blue-600 text-sm"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
      
      {/* Custom Format Option */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => onBankSelected('custom', 'Custom Format')}
          className={`w-full p-4 rounded-lg border-2 border-dashed text-center transition-all ${
            selectedBank === 'custom'
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <SettingsIcon size={20} className="text-gray-500" />
            <span className="font-medium text-gray-700 dark:text-gray-300">
              Custom Format (Manual Mapping)
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Set up custom column mappings for unsupported formats
          </p>
        </button>
      </div>
    </div>
  );
}
