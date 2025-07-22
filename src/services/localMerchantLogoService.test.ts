/**
 * LocalMerchantLogoService Tests
 * Tests for the local merchant logo service that identifies merchants from transaction descriptions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { localMerchantLogoService } from './localMerchantLogoService';
import type { BrandLogo } from '../data/brandDatabase';

// Mock the brand database
vi.mock('../data/brandDatabase', () => ({
  brandLogos: [
    {
      name: 'Amazon',
      domain: 'amazon.com',
      keywords: ['amazon', 'amzn', 'prime'],
      category: 'retail' as const,
      color: '#FF9900'
    },
    {
      name: 'Tesco',
      domain: 'tesco.com',
      keywords: ['tesco', 'tesco express', 'tesco metro'],
      category: 'food' as const,
      color: '#005EB8'
    },
    {
      name: 'Netflix',
      domain: 'netflix.com',
      keywords: ['netflix'],
      category: 'entertainment' as const,
      color: '#E50914'
    },
    {
      name: 'Transport for London',
      domain: 'tfl.gov.uk',
      keywords: ['tfl', 'transport for london', 'oyster'],
      category: 'transport' as const,
      color: '#000080'
    },
    {
      name: 'British Gas',
      domain: 'britishgas.co.uk',
      keywords: ['british gas', 'britgas'],
      category: 'utilities' as const,
      color: '#0066CC'
    }
  ],
  
  searchBrands: vi.fn((query: string) => {
    const mockBrands = [
      {
        name: 'Amazon',
        domain: 'amazon.com',
        keywords: ['amazon', 'amzn', 'prime'],
        category: 'retail' as const,
        color: '#FF9900'
      },
      {
        name: 'Tesco',
        domain: 'tesco.com',
        keywords: ['tesco', 'tesco express', 'tesco metro'],
        category: 'food' as const,
        color: '#005EB8'
      }
    ];
    
    return mockBrands.filter(brand => 
      brand.name.toLowerCase().includes(query.toLowerCase()) ||
      brand.keywords.some(k => k.includes(query.toLowerCase()))
    );
  }),
  
  getBrandByDomain: vi.fn(),
  getBrandByKeyword: vi.fn()
}));

// Mock btoa for Node environment
global.btoa = (str: string) => Buffer.from(str).toString('base64');

describe('LocalMerchantLogoService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Force re-instantiation to pick up mocked data
    (localMerchantLogoService as any).brandMap.clear();
    (localMerchantLogoService as any).keywordMap.clear();
    (localMerchantLogoService as any).constructor.call(localMerchantLogoService);
  });

  describe('getMerchantInfo', () => {
    it('returns null for empty description', () => {
      expect(localMerchantLogoService.getMerchantInfo('')).toBeNull();
      expect(localMerchantLogoService.getMerchantInfo(null as any)).toBeNull();
    });

    it('finds merchant by exact keyword match', () => {
      const result = localMerchantLogoService.getMerchantInfo('Purchase at Amazon');
      
      expect(result).toBeDefined();
      expect(result?.name).toBe('Amazon');
      expect(result?.category).toBe('retail');
    });

    it('finds merchant by case-insensitive match', () => {
      const result = localMerchantLogoService.getMerchantInfo('NETFLIX SUBSCRIPTION');
      
      expect(result).toBeDefined();
      expect(result?.name).toBe('Netflix');
    });

    it('removes common transaction prefixes', () => {
      const prefixes = [
        'CARD PURCHASE Amazon',
        'DIRECT DEBIT Tesco',
        'STANDING ORDER Netflix',
        'BANK TRANSFER British Gas',
        'POS Tesco Express',
        'CONTACTLESS Amazon',
        'ONLINE Netflix'
      ];
      
      const results = prefixes.map(desc => localMerchantLogoService.getMerchantInfo(desc));
      
      expect(results[0]?.name).toBe('Amazon');
      expect(results[1]?.name).toBe('Tesco');
      expect(results[2]?.name).toBe('Netflix');
      expect(results[3]?.name).toBe('British Gas');
      expect(results[4]?.name).toBe('Tesco');
      expect(results[5]?.name).toBe('Amazon');
      expect(results[6]?.name).toBe('Netflix');
    });

    it('handles multi-word brand names', () => {
      const result = localMerchantLogoService.getMerchantInfo('Transport for London charge');
      
      expect(result).toBeDefined();
      expect(result?.name).toBe('Transport for London');
    });

    it('finds merchant by partial keyword match', () => {
      const result = localMerchantLogoService.getMerchantInfo('Shopping at Tesco Express');
      
      expect(result).toBeDefined();
      expect(result?.name).toBe('Tesco');
    });

    it('removes special characters and numbers', () => {
      const result = localMerchantLogoService.getMerchantInfo('*1234 Amazon #5678');
      
      expect(result).toBeDefined();
      expect(result?.name).toBe('Amazon');
    });

    it('handles descriptions with multiple merchants (returns first match)', () => {
      const result = localMerchantLogoService.getMerchantInfo('Amazon payment for Netflix');
      
      expect(result).toBeDefined();
      expect(result?.name).toBe('Amazon'); // First match
    });

    it('falls back to search when no exact match', () => {
      const { searchBrands } = require('../data/brandDatabase');
      
      const result = localMerchantLogoService.getMerchantInfo('Some unknown merchant AMZN');
      
      expect(searchBrands).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result?.name).toBe('Amazon');
    });

    it('returns null when no match found', () => {
      const { searchBrands } = require('../data/brandDatabase');
      searchBrands.mockReturnValueOnce([]);
      
      const result = localMerchantLogoService.getMerchantInfo('Unknown Random Store 123');
      
      expect(result).toBeNull();
    });

    it('matches by brand name', () => {
      const result = localMerchantLogoService.getMerchantInfo('Payment to NETFLIX LTD');
      
      expect(result).toBeDefined();
      expect(result?.name).toBe('Netflix');
    });

    it('handles hyphenated descriptions', () => {
      const result = localMerchantLogoService.getMerchantInfo('BRITISH-GAS-ENERGY');
      
      expect(result).toBeDefined();
      expect(result?.name).toBe('British Gas');
    });

    it('ignores very short words', () => {
      const result = localMerchantLogoService.getMerchantInfo('DD TO TFL LTD');
      
      expect(result).toBeDefined();
      expect(result?.name).toBe('Transport for London');
    });
  });

  describe('getBrandIcon', () => {
    it('returns data URI with brand color', () => {
      const brand: BrandLogo = {
        name: 'Amazon',
        domain: 'amazon.com',
        keywords: ['amazon'],
        category: 'retail',
        color: '#FF9900'
      };
      
      const icon = localMerchantLogoService.getBrandIcon(brand);
      
      expect(icon).toMatch(/^data:image\/svg\+xml;base64,/);
      expect(icon).toContain(btoa('#FF9900'));
    });

    it('uses correct category icon for retail', () => {
      const brand: BrandLogo = {
        name: 'Test',
        domain: 'test.com',
        keywords: ['test'],
        category: 'retail',
        color: '#000000'
      };
      
      const icon = localMerchantLogoService.getBrandIcon(brand);
      const decoded = atob(icon.split(',')[1]);
      
      expect(decoded).toContain('M19 6h-2c0-2.76'); // Shopping bag icon
    });

    it('uses correct category icon for food', () => {
      const brand: BrandLogo = {
        name: 'Test',
        domain: 'test.com',
        keywords: ['test'],
        category: 'food',
        color: '#000000'
      };
      
      const icon = localMerchantLogoService.getBrandIcon(brand);
      const decoded = atob(icon.split(',')[1]);
      
      expect(decoded).toContain('M11 9H9V2H7v7'); // Restaurant icon
    });

    it('uses correct category icon for transport', () => {
      const brand: BrandLogo = {
        name: 'Test',
        domain: 'test.com',
        keywords: ['test'],
        category: 'transport',
        color: '#000000'
      };
      
      const icon = localMerchantLogoService.getBrandIcon(brand);
      const decoded = atob(icon.split(',')[1]);
      
      expect(decoded).toContain('M18.92 5.01'); // Car icon
    });

    it('uses default icon for unknown category', () => {
      const brand: BrandLogo = {
        name: 'Test',
        domain: 'test.com',
        keywords: ['test'],
        category: 'unknown' as any,
        color: '#000000'
      };
      
      const icon = localMerchantLogoService.getBrandIcon(brand);
      const decoded = atob(icon.split(',')[1]);
      
      expect(decoded).toContain('M12 2C6.48'); // Default circle icon
    });
  });

  describe('getAllBrands', () => {
    it('returns all brands from database', () => {
      const brands = localMerchantLogoService.getAllBrands();
      
      expect(brands).toHaveLength(5);
      expect(brands.map(b => b.name)).toContain('Amazon');
      expect(brands.map(b => b.name)).toContain('Tesco');
      expect(brands.map(b => b.name)).toContain('Netflix');
    });
  });

  describe('searchBrands', () => {
    it('delegates to brandDatabase search', () => {
      const { searchBrands } = require('../data/brandDatabase');
      
      const results = localMerchantLogoService.searchBrands('amazon');
      
      expect(searchBrands).toHaveBeenCalledWith('amazon');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Amazon');
    });

    it('returns empty array for no matches', () => {
      const { searchBrands } = require('../data/brandDatabase');
      searchBrands.mockReturnValueOnce([]);
      
      const results = localMerchantLogoService.searchBrands('unknown');
      
      expect(results).toEqual([]);
    });
  });

  describe('initialization', () => {
    it('builds brand map by domain', () => {
      const brandMap = (localMerchantLogoService as any).brandMap;
      
      expect(brandMap.get('amazon.com')?.name).toBe('Amazon');
      expect(brandMap.get('tesco.com')?.name).toBe('Tesco');
      expect(brandMap.get('netflix.com')?.name).toBe('Netflix');
    });

    it('builds keyword map with all keywords', () => {
      const keywordMap = (localMerchantLogoService as any).keywordMap;
      
      expect(keywordMap.get('amazon')?.name).toBe('Amazon');
      expect(keywordMap.get('amzn')?.name).toBe('Amazon');
      expect(keywordMap.get('prime')?.name).toBe('Amazon');
      expect(keywordMap.get('tesco express')?.name).toBe('Tesco');
    });

    it('includes brand names in keyword map', () => {
      const keywordMap = (localMerchantLogoService as any).keywordMap;
      
      expect(keywordMap.get('amazon')?.name).toBe('Amazon');
      expect(keywordMap.get('netflix')?.name).toBe('Netflix');
      expect(keywordMap.get('transport for london')?.name).toBe('Transport for London');
    });

    it('converts keywords to lowercase', () => {
      const keywordMap = (localMerchantLogoService as any).keywordMap;
      
      // All keys should be lowercase
      Array.from(keywordMap.keys()).forEach(key => {
        expect(key).toBe(key.toLowerCase());
      });
    });
  });

  describe('edge cases', () => {
    it('handles descriptions with only numbers and special chars', () => {
      const result = localMerchantLogoService.getMerchantInfo('***123456789###');
      
      expect(result).toBeNull();
    });

    it('handles very long descriptions', () => {
      const longDesc = 'This is a very long transaction description that contains the word Amazon somewhere in the middle of all this text';
      const result = localMerchantLogoService.getMerchantInfo(longDesc);
      
      expect(result?.name).toBe('Amazon');
    });

    it('handles descriptions with multiple spaces', () => {
      const result = localMerchantLogoService.getMerchantInfo('Payment    to     Amazon     UK');
      
      expect(result?.name).toBe('Amazon');
    });

    it('prioritizes exact matches over partial matches', () => {
      // 'prime' is a keyword for Amazon, but we have exact match for 'Netflix'
      const result = localMerchantLogoService.getMerchantInfo('Netflix prime subscription');
      
      expect(result?.name).toBe('Netflix');
    });
  });
});