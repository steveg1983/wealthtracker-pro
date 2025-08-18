/**
 * LocalMerchantLogoService Tests
 * Tests for the local merchant logo service that identifies merchants from transaction descriptions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { BrandLogo } from '../data/brandDatabase';

// Mock the brand database before importing the service
vi.mock('../data/brandDatabase', () => {
  const mockBrandLogos: BrandLogo[] = [
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
  ];

  return {
    brandLogos: mockBrandLogos,
    
    searchBrands: vi.fn((query: string) => {
      return mockBrandLogos.filter(brand => 
        brand.name.toLowerCase().includes(query.toLowerCase()) ||
        brand.keywords.some(k => k.includes(query.toLowerCase()))
      );
    }),
    
    getBrandByDomain: vi.fn((domain: string) => {
      return mockBrandLogos.find(b => b.domain === domain);
    }),
    
    getBrandByKeyword: vi.fn((keyword: string) => {
      return mockBrandLogos.find(b => 
        b.keywords.some(k => k.toLowerCase() === keyword.toLowerCase())
      );
    }),

    BrandLogo: {} as any
  };
});

// Mock btoa for Node environment
global.btoa = (str: string) => Buffer.from(str).toString('base64');

// Import the service after mocks are set up
import { localMerchantLogoService } from './localMerchantLogoService';
import { searchBrands } from '../data/brandDatabase';

describe('LocalMerchantLogoService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      const result = localMerchantLogoService.getMerchantInfo('TESCO EXPRESS LONDON');
      
      expect(result).toBeDefined();
      expect(result?.name).toBe('Tesco');
    });

    it('removes common transaction prefixes', () => {
      const result = localMerchantLogoService.getMerchantInfo('CARD PURCHASE TESCO METRO');
      
      expect(result).toBeDefined();
      expect(result?.name).toBe('Tesco');
    });

    it('handles multi-word brand names', () => {
      const result = localMerchantLogoService.getMerchantInfo('Payment to British Gas');
      
      expect(result).toBeDefined();
      expect(result?.name).toBe('British Gas');
    });

    it('finds merchant by partial keyword match', () => {
      const result = localMerchantLogoService.getMerchantInfo('TFL Oyster Card Top Up');
      
      expect(result).toBeDefined();
      expect(result?.name).toBe('Transport for London');
    });

    it('removes special characters and numbers', () => {
      const result = localMerchantLogoService.getMerchantInfo('AMAZON*123456 MARKETPLACE');
      
      expect(result).toBeDefined();
      expect(result?.name).toBe('Amazon');
    });

    it('handles descriptions with multiple merchants (returns first match)', () => {
      const result = localMerchantLogoService.getMerchantInfo('Amazon payment for Netflix subscription');
      
      expect(result).toBeDefined();
      // Should return first match
      expect(result?.name).toBe('Amazon');
    });

    it('falls back to search when no exact match', () => {
      // Test a description that doesn't match any keywords directly
      const result = localMerchantLogoService.getMerchantInfo('Online Shopping');
      
      // Since 'shopping' doesn't match any keywords, it should return null
      expect(result).toBeNull();
    });

    it('returns null when no match found', () => {
      const result = localMerchantLogoService.getMerchantInfo('Random Store Purchase');
      
      expect(result).toBeNull();
    });

    it('matches by brand name', () => {
      const result = localMerchantLogoService.getMerchantInfo('Payment to Netflix');
      
      expect(result).toBeDefined();
      expect(result?.name).toBe('Netflix');
    });

    it('handles hyphenated descriptions', () => {
      const result = localMerchantLogoService.getMerchantInfo('TESCO-EXPRESS-PURCHASE');
      
      expect(result).toBeDefined();
      expect(result?.name).toBe('Tesco');
    });

    it('ignores very short words', () => {
      const result = localMerchantLogoService.getMerchantInfo('at in on Amazon UK');
      
      expect(result).toBeDefined();
      expect(result?.name).toBe('Amazon');
    });
  });

  describe('getBrandIcon', () => {
    it('returns data URI with brand color', () => {
      const brand: BrandLogo = {
        name: 'Test Brand',
        domain: 'test.com',
        keywords: ['test'],
        category: 'retail',
        color: '#FF0000'
      };
      
      const result = localMerchantLogoService.getBrandIcon(brand);
      
      expect(result).toMatch(/^data:image\/svg\+xml;base64,/);
      // Decode and check the color was applied
      const decoded = atob(result.split(',')[1]);
      expect(decoded).toContain('#FF0000');
    });

    it('uses correct category icon for retail', () => {
      const brand: BrandLogo = {
        name: 'Test',
        domain: 'test.com',
        keywords: ['test'],
        category: 'retail',
        color: '#000000'
      };
      
      const result = localMerchantLogoService.getBrandIcon(brand);
      const decoded = atob(result.split(',')[1]);
      
      expect(decoded).toContain('viewBox="0 0 24 24"');
      // Check that the color was replaced
      expect(decoded).toContain('#000000');
      expect(decoded).not.toContain('currentColor');
    });

    it('uses correct category icon for food', () => {
      const brand: BrandLogo = {
        name: 'Test',
        domain: 'test.com',
        keywords: ['test'],
        category: 'food',
        color: '#000000'
      };
      
      const result = localMerchantLogoService.getBrandIcon(brand);
      const decoded = atob(result.split(',')[1]);
      
      expect(decoded).toContain('viewBox="0 0 24 24"');
    });

    it('uses correct category icon for transport', () => {
      const brand: BrandLogo = {
        name: 'Test',
        domain: 'test.com',
        keywords: ['test'],
        category: 'transport',
        color: '#000000'
      };
      
      const result = localMerchantLogoService.getBrandIcon(brand);
      const decoded = atob(result.split(',')[1]);
      
      expect(decoded).toContain('viewBox="0 0 24 24"');
    });

    it('uses default icon for unknown category', () => {
      const brand: BrandLogo = {
        name: 'Test',
        domain: 'test.com',
        keywords: ['test'],
        category: 'unknown-category' as any,
        color: '#000000'
      };
      
      const result = localMerchantLogoService.getBrandIcon(brand);
      const decoded = atob(result.split(',')[1]);
      
      // Should use the 'other' category icon
      expect(decoded).toContain('viewBox="0 0 24 24"');
    });
  });

  describe('getAllBrands', () => {
    it('returns all brands from database', () => {
      const result = localMerchantLogoService.getAllBrands();
      
      expect(result).toHaveLength(5); // We have 5 mock brands
      expect(result.some(b => b.name === 'Amazon')).toBe(true);
      expect(result.some(b => b.name === 'Tesco')).toBe(true);
    });
  });

  describe('searchBrands', () => {
    it('delegates to brandDatabase search', () => {
      const query = 'amazon';
      const result = localMerchantLogoService.searchBrands(query);
      
      expect(searchBrands).toHaveBeenCalledWith(query);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Amazon');
    });

    it('returns empty array for no matches', () => {
      const result = localMerchantLogoService.searchBrands('nonexistent');
      
      expect(result).toEqual([]);
    });
  });

  describe('initialization', () => {
    it('builds brand map by domain', () => {
      // We can test this indirectly through getMerchantInfo
      const result = localMerchantLogoService.getMerchantInfo('amazon.com purchase');
      
      expect(result).toBeDefined();
      expect(result?.domain).toBe('amazon.com');
    });

    it('builds keyword map with all keywords', () => {
      // Test that all keywords work
      const result1 = localMerchantLogoService.getMerchantInfo('amzn purchase');
      const result2 = localMerchantLogoService.getMerchantInfo('prime subscription');
      
      expect(result1?.name).toBe('Amazon');
      expect(result2?.name).toBe('Amazon');
    });

    it('includes brand names in keyword map', () => {
      // Brand names should work as keywords
      const result = localMerchantLogoService.getMerchantInfo('transport for london payment');
      
      expect(result).toBeDefined();
      expect(result?.name).toBe('Transport for London');
    });

    it('converts keywords to lowercase', () => {
      // Keywords should work regardless of case
      const result = localMerchantLogoService.getMerchantInfo('AMZN MARKETPLACE');
      
      expect(result).toBeDefined();
      expect(result?.name).toBe('Amazon');
    });
  });

  describe('edge cases', () => {
    it('handles descriptions with only numbers and special chars', () => {
      const result = localMerchantLogoService.getMerchantInfo('*#123456#*');
      
      expect(result).toBeNull();
    });

    it('handles very long descriptions', () => {
      const longDesc = 'This is a very long description that contains the word Amazon somewhere in the middle of all this text';
      const result = localMerchantLogoService.getMerchantInfo(longDesc);
      
      expect(result).toBeDefined();
      expect(result?.name).toBe('Amazon');
    });

    it('handles descriptions with multiple spaces', () => {
      const result = localMerchantLogoService.getMerchantInfo('TESCO    EXPRESS    STORE');
      
      expect(result).toBeDefined();
      expect(result?.name).toBe('Tesco');
    });

    it('prioritizes exact matches over partial matches', () => {
      // If we had overlapping keywords, exact matches should win
      const result = localMerchantLogoService.getMerchantInfo('tesco express checkout');
      
      expect(result).toBeDefined();
      expect(result?.name).toBe('Tesco');
    });
  });
});