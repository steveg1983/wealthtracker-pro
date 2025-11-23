import { brandLogos, searchBrands, BrandLogo } from '../data/brandDatabase';

// Simple SVG icon templates for different categories
const categoryIcons = {
  retail: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm7 17H5V8h14v12z"/></svg>',
  food: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/></svg>',
  transport: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M18.92 5.01C18.72 4.42 18.16 4 17.5 4h-11c-.66 0-1.21.42-1.42 1.01L3 11v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 15c-.83 0-1.5-.67-1.5-1.5S5.67 12 6.5 12s1.5.67 1.5 1.5S7.33 15 6.5 15zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 10l1.5-4.5h11L19 10H5z"/></svg>',
  entertainment: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l.01 10.55c-.59-.34-1.27-.55-2-.55C7.79 12 6 13.79 6 16s1.79 4 4.01 4S14 18.21 14 16V4h4V2h-6z"/></svg>',
  finance: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1.93.66 1.64 2.08 1.64 1.51 0 2.1-.59 2.1-1.42 0-.89-.4-1.34-2.37-1.83-2.49-.57-3.66-1.49-3.66-3.25 0-1.74 1.26-2.93 3.07-3.31V4.59h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s3.2 1.36 3.2 3.1c-.01 1.87-1.68 3.03-3.14 3.38z"/></svg>',
  utilities: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>',
  tech: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/></svg>',
  other: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/></svg>'
};

export class LocalMerchantLogoService {
  private brandMap: Map<string, BrandLogo> = new Map();
  private keywordMap: Map<string, BrandLogo> = new Map();

  constructor() {
    // Build lookup maps
    brandLogos.forEach(brand => {
      // Map by domain
      this.brandMap.set(brand.domain, brand);
      
      // Map by keywords
      brand.keywords.forEach(keyword => {
        this.keywordMap.set(keyword.toLowerCase(), brand);
      });
      
      // Also map by brand name
      this.keywordMap.set(brand.name.toLowerCase(), brand);
    });
  }

  /**
   * Get merchant info from transaction description
   */
  getMerchantInfo(description: string): BrandLogo | null {
    if (!description) return null;
    
    const cleanDescription = description.toLowerCase()
      .replace(/^(card purchase|direct debit|standing order|bank transfer|pos|contactless|online)[\s-]*/i, '')
      .replace(/[*#\d]/g, '') // Remove numbers and special chars
      .trim();

    // First, try exact keyword matches
    for (const [keyword, brand] of Array.from(this.keywordMap.entries())) {
      if (cleanDescription.includes(keyword)) {
        return brand;
      }
    }

    // Then try partial matches for common patterns
    const words = cleanDescription.split(/[\s-,]/);
    for (const word of words) {
      if (word.length > 2) {
        const brand = this.keywordMap.get(word);
        if (brand) {
          return brand;
        }
      }
    }

    // Try searching with the first meaningful word
    const firstWord = words.find(w => w.length > 3);
    if (firstWord) {
      const searchResults = searchBrands(firstWord);
      if (searchResults.length > 0) {
        return searchResults[0];
      }
    }

    return null;
  }

  /**
   * Get SVG icon for a brand
   */
  getBrandIcon(brand: BrandLogo): string {
    // For now, return a category-based SVG icon
    // In the future, we could add actual brand SVGs to the database
    const template = categoryIcons[brand.category] || categoryIcons.other;
    
    // Create a data URI with the brand color
    return `data:image/svg+xml;base64,${btoa(
      template.replace('currentColor', brand.color)
    )}`;
  }

  /**
   * Get all brands for display
   */
  getAllBrands(): BrandLogo[] {
    return brandLogos;
  }

  /**
   * Search brands
   */
  searchBrands(query: string): BrandLogo[] {
    return searchBrands(query);
  }
}

export const localMerchantLogoService = new LocalMerchantLogoService();