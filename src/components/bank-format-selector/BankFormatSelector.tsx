import React, { useState, useCallback, useEffect, memo } from 'react';
import { SearchFilters } from './SearchFilters';
import { BankGridView } from './BankGridView';
import { BankListView } from './BankListView';
import { CustomFormatOption } from './CustomFormatOption';
import { EmptyState } from './EmptyState';
import { useBankFilter } from './useBankFilter';
import { BANK_FORMATS, REGION_GROUPS } from './bankData';
import type { BankFormat } from './bankData';
import { logger } from '../../services/loggingService';

interface BankFormatSelectorProps {
  onBankSelected: (bankKey: string, bankName: string) => void;
  selectedBank?: string | null;
  className?: string;
  viewMode?: 'grid' | 'list';
}

/**
 * Bank format selector for import configuration
 * Provides searchable, filterable interface for selecting bank formats
 */
export const BankFormatSelector = memo(function BankFormatSelector({
  onBankSelected,
  selectedBank = null,
  className = '',
  viewMode = 'grid'
}: BankFormatSelectorProps): React.JSX.Element {
  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedType, setSelectedType] = useState('all');

  // Component initialization logging
  useEffect(() => {
    logger.info('BankFormatSelector component initialized', {
      componentName: 'BankFormatSelector',
      banksCount: BANK_FORMATS.length,
      selectedBank,
        viewMode,
        regions: Object.keys(REGION_GROUPS).length
      });
    }, [selectedBank, viewMode]);

    // Use custom hook for filtering and grouping
    const { filteredBanks, groupedBanks } = useBankFilter({
      banks: BANK_FORMATS,
      searchTerm,
      selectedRegion,
      selectedType
    });

    // Event handlers with logging and error handling
    const handleBankSelect = useCallback((bank: BankFormat): void => {
      try {
        logger.info('Bank selected', {
          bankKey: bank.key,
          bankName: bank.name,
          bankRegion: bank.region,
          bankType: bank.type
        });
        onBankSelected(bank.key, bank.name);
      } catch (error) {
        logger.error('Error selecting bank:', error);
      }
    }, [onBankSelected]);

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      try {
        const newSearchTerm = e.target.value;
        logger.debug('Search term changed', { searchTerm: newSearchTerm });
        setSearchTerm(newSearchTerm);
      } catch (error) {
        logger.error('Error handling search change:', error);
      }
    }, []);

    const handleRegionChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
      try {
        const newRegion = e.target.value;
        logger.debug('Region filter changed', { region: newRegion });
        setSelectedRegion(newRegion);
      } catch (error) {
        logger.error('Error handling region change:', error);
      }
    }, []);

    const handleTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
      try {
        const newType = e.target.value;
        logger.debug('Type filter changed', { type: newType });
        setSelectedType(newType);
      } catch (error) {
        logger.error('Error handling type change:', error);
      }
    }, []);

    const handleClearFilters = useCallback(() => {
      try {
        logger.info('Filters cleared');
        setSearchTerm('');
        setSelectedRegion('all');
        setSelectedType('all');
      } catch (error) {
        logger.error('Error clearing filters:', error);
      }
    }, []);

    const handleCustomSelect = useCallback(() => {
      try {
        logger.info('Custom format selected');
        onBankSelected('custom', 'Custom Format');
      } catch (error) {
        logger.error('Error selecting custom format:', error);
      }
    }, [onBankSelected]);

    try {
      return (
      <div className={`bank-format-selector ${className}`}>
        <SearchFilters
          searchTerm={searchTerm}
          selectedRegion={selectedRegion}
          selectedType={selectedType}
          onSearchChange={handleSearchChange}
          onRegionChange={handleRegionChange}
          onTypeChange={handleTypeChange}
          onClearFilters={handleClearFilters}
        />

        {/* Results */}
        <div className="space-y-6">
          {filteredBanks.length === 0 ? (
            <EmptyState onClearFilters={handleClearFilters} />
          ) : (
            Object.entries(groupedBanks).map(([groupName, banks]) => (
              <div key={groupName}>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  {groupName} ({banks.length})
                </h3>

                {viewMode === 'grid' ? (
                  <BankGridView
                    banks={banks}
                    selectedBank={selectedBank}
                    onBankSelect={handleBankSelect}
                  />
                ) : (
                  <BankListView
                    banks={banks}
                    selectedBank={selectedBank}
                    onBankSelect={handleBankSelect}
                  />
                )}
              </div>
            ))
          )}
        </div>

        <CustomFormatOption
          selectedBank={selectedBank}
          onCustomSelect={handleCustomSelect}
        />
      </div>
    );
  } catch (error) {
    logger.error('BankFormatSelector render error:', error);
    return (
      <div className={`bank-format-selector ${className}`}>
        <div className="text-center py-8">
          <p className="text-red-600 dark:text-red-400 mb-4">
            Error loading bank formats
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
});