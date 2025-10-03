import { useMemo } from 'react';
import type { BankFormat } from './bankData';
import { REGION_GROUPS, TYPE_GROUPS } from './bankData';
import { useLogger } from '../services/ServiceProvider';

interface UseBankFilterProps {
  banks: BankFormat[];
  searchTerm: string;
  selectedRegion: string;
  selectedType: string;
}

interface UseBankFilterReturn {
  filteredBanks: BankFormat[];
  groupedBanks: Record<string, BankFormat[]>;
}

/**
 * Custom hook for filtering and grouping bank formats
 * Handles search, region, and type filtering with performance optimization
 */
export function useBankFilter({ banks,
  searchTerm,
  selectedRegion,
  selectedType
 }: UseBankFilterProps): UseBankFilterReturn {
  const logger = useLogger();
  const filteredBanks = useMemo(() => {
    try {
      let filtered = banks;

      // Apply search filter
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase().trim();
        filtered = filtered.filter(bank =>
          bank.name.toLowerCase().includes(searchLower) ||
          bank.key.toLowerCase().includes(searchLower) ||
          bank.region.toLowerCase().includes(searchLower) ||
          TYPE_GROUPS[bank.type].toLowerCase().includes(searchLower)
        );
      }

      // Apply region filter
      if (selectedRegion !== 'all') {
        filtered = filtered.filter(bank => bank.region.toLowerCase() === selectedRegion);
      }

      // Apply type filter
      if (selectedType !== 'all') {
        filtered = filtered.filter(bank => bank.type === selectedType);
      }

      logger.debug('Bank filtering applied', {
        totalBanks: banks.length,
        filteredCount: filtered.length,
        searchTerm,
        selectedRegion,
        selectedType
      });

      return filtered;
    } catch (error) {
      logger.error('Error filtering banks:', error);
      return banks;
    }
  }, [banks, searchTerm, selectedRegion, selectedType]);

  const groupedBanks = useMemo(() => {
    try {
      const groups: Record<string, BankFormat[]> = {};
      
      filteredBanks.forEach(bank => {
        const regionName = REGION_GROUPS[bank.region as keyof typeof REGION_GROUPS] || bank.region;
        if (!groups[regionName]) {
          groups[regionName] = [];
        }
        groups[regionName].push(bank);
      });

      // Sort banks within each group by name
      Object.keys(groups).forEach(groupName => {
        groups[groupName].sort((a, b) => a.name.localeCompare(b.name));
      });

      logger.debug('Banks grouped by region', {
        groupCount: Object.keys(groups).length,
        groups: Object.keys(groups)
      });

      return groups;
    } catch (error) {
      logger.error('Error grouping banks:', error);
      return {};
    }
  }, [filteredBanks]);

  return {
    filteredBanks,
    groupedBanks
  };
}