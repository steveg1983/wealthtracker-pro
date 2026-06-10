import React from 'react';
import type { ColumnMapping } from '../services/enhancedCsvImportService';
import { enhancedCsvImportService } from '../services/enhancedCsvImportService';

interface CSVBankTemplatesProps {
  onSelectBank: (mappings: ColumnMapping[]) => void;
}

const UK_MAJOR = ['Barclays', 'HSBC', 'Lloyds', 'NatWest', 'Santander', 'Halifax', 'RBS', 'TSB'];
const UK_BUILDING_SOCIETIES = ['Nationwide', 'Yorkshire', 'Coventry', 'Skipton'];
const UK_DIGITAL = ['Monzo', 'Starling', 'Revolut', 'Chase UK', 'Metro Bank', 'Virgin Money'];
const UK_CREDIT = ['Amex UK', 'Capital One UK', 'MBNA', 'Tesco Bank'];
const US_BANKS = ['Chase', 'Bank of America', 'Wells Fargo', 'Citi', 'US Bank', 'Capital One', 'Amex', 'Discover'];
const EU_BANKS = ['N26', 'ING', 'Rabobank', 'ABN AMRO', 'Deutsche Bank', 'Commerzbank', 'BNP Paribas'];
const PLATFORMS = ['PayPal', 'Wise', 'Stripe', 'Square'];

function BankGrid({ title, banks, onSelect }: { title: string; banks: string[]; onSelect: (bank: string) => void }) {
  return (
    <div className="mb-4">
      <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">{title}</h5>
      <div className="grid grid-cols-2 gap-2">
        {banks.map(bank => (
          <button
            key={bank}
            className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-left"
            onClick={() => onSelect(bank)}
          >
            {bank}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CSVBankTemplates({ onSelectBank }: CSVBankTemplatesProps): React.JSX.Element {
  const handleSelect = (bank: string) => {
    const mappings = enhancedCsvImportService.getBankMappings(bank.toLowerCase());
    onSelectBank(mappings);
  };

  return (
    <div className="mt-8 w-full max-w-4xl">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        Quick Start with Bank Templates
      </h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Select your bank to auto-configure column mappings. Supports 40+ bank formats worldwide.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <BankGrid title="UK Major Banks" banks={UK_MAJOR} onSelect={handleSelect} />
          <BankGrid title="UK Building Societies" banks={UK_BUILDING_SOCIETIES} onSelect={handleSelect} />
          <BankGrid title="UK Digital Banks" banks={UK_DIGITAL} onSelect={handleSelect} />
          <BankGrid title="UK Credit Cards" banks={UK_CREDIT} onSelect={handleSelect} />
        </div>
        <div>
          <BankGrid title="US Banks" banks={US_BANKS} onSelect={handleSelect} />
          <BankGrid title="European Banks" banks={EU_BANKS} onSelect={handleSelect} />
          <BankGrid title="Payment Platforms" banks={PLATFORMS} onSelect={handleSelect} />
        </div>
      </div>
    </div>
  );
}
