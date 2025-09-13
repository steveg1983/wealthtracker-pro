/**
 * Tax Categories Module
 * Manages tax categories and category identification
 */

import type { TaxCategory } from './types';
import type { Transaction } from '../../types';
import { toDecimal } from '../../utils/decimal';

/**
 * Default tax categories for individuals
 */
export const DEFAULT_TAX_CATEGORIES: TaxCategory[] = [
  {
    id: 'mortgage-interest',
    name: 'Mortgage Interest',
    description: 'Interest paid on mortgage loans',
    deductible: true,
    form: '1098'
  },
  {
    id: 'property-tax',
    name: 'Property Tax',
    description: 'State and local property taxes',
    deductible: true,
    maxDeduction: toDecimal(10000) // SALT limit
  },
  {
    id: 'charitable',
    name: 'Charitable Donations',
    description: 'Donations to qualified charitable organizations',
    deductible: true
  },
  {
    id: 'medical',
    name: 'Medical Expenses',
    description: 'Qualified medical and dental expenses',
    deductible: true
  },
  {
    id: 'business-expenses',
    name: 'Business Expenses',
    description: 'Expenses related to self-employment or business',
    deductible: true,
    form: 'Schedule C'
  },
  {
    id: 'education',
    name: 'Education Expenses',
    description: 'Qualified education expenses and student loan interest',
    deductible: true
  },
  {
    id: 'retirement',
    name: 'Retirement Contributions',
    description: 'Contributions to traditional IRA, 401(k), etc.',
    deductible: true
  },
  {
    id: 'hsa',
    name: 'HSA Contributions',
    description: 'Health Savings Account contributions',
    deductible: true,
    maxDeduction: toDecimal(3850) // 2024 individual limit
  },
  {
    id: 'state-income-tax',
    name: 'State Income Tax',
    description: 'State income tax payments',
    deductible: true,
    maxDeduction: toDecimal(10000) // Part of SALT limit
  },
  {
    id: 'home-office',
    name: 'Home Office',
    description: 'Home office expenses for business use',
    deductible: true,
    form: 'Form 8829'
  }
];

/**
 * Tax category identification service
 */
export class TaxCategoryService {
  private categories: TaxCategory[] = DEFAULT_TAX_CATEGORIES;
  private keywordMap: Map<string, string> = new Map();

  constructor() {
    this.initializeKeywordMap();
  }

  /**
   * Initialize keyword mapping for category identification
   */
  private initializeKeywordMap(): void {
    // Mortgage interest keywords
    ['mortgage interest', 'home loan interest', 'mortgage payment']
      .forEach(kw => this.keywordMap.set(kw, 'mortgage-interest'));

    // Property tax keywords
    ['property tax', 'real estate tax', 'county tax', 'city tax']
      .forEach(kw => this.keywordMap.set(kw, 'property-tax'));

    // Charitable keywords
    ['charity', 'donation', 'charitable', 'nonprofit', 'church', 'temple', 'mosque']
      .forEach(kw => this.keywordMap.set(kw, 'charitable'));

    // Medical keywords
    ['medical', 'doctor', 'hospital', 'pharmacy', 'dental', 'vision', 'health']
      .forEach(kw => this.keywordMap.set(kw, 'medical'));

    // Business expense keywords
    ['business', 'office supplies', 'equipment', 'software license', 'professional']
      .forEach(kw => this.keywordMap.set(kw, 'business-expenses'));

    // Education keywords
    ['tuition', 'student loan', 'education', 'school', 'university', 'college']
      .forEach(kw => this.keywordMap.set(kw, 'education'));

    // Retirement keywords
    ['401k', '403b', 'ira', 'retirement', 'pension']
      .forEach(kw => this.keywordMap.set(kw, 'retirement'));

    // HSA keywords
    ['hsa', 'health savings', 'health savings account']
      .forEach(kw => this.keywordMap.set(kw, 'hsa'));

    // State tax keywords
    ['state tax', 'state income', 'estimated tax payment']
      .forEach(kw => this.keywordMap.set(kw, 'state-income-tax'));

    // Home office keywords
    ['home office', 'remote work expense', 'wfh expense']
      .forEach(kw => this.keywordMap.set(kw, 'home-office'));
  }

  /**
   * Identify tax category for a transaction
   */
  identifyCategory(transaction: Transaction): TaxCategory | null {
    const description = transaction.description.toLowerCase();
    const merchant = (transaction.merchant || '').toLowerCase();
    const category = (transaction.category || '').toLowerCase();
    
    // Check all text fields for keywords
    const searchText = `${description} ${merchant} ${category}`;
    
    // Check for exact keyword matches
    for (const [keyword, categoryId] of this.keywordMap) {
      if (searchText.includes(keyword)) {
        return this.categories.find(c => c.id === categoryId) || null;
      }
    }
    
    // Check for merchant-specific patterns
    if (merchant) {
      const merchantCategory = this.identifyByMerchant(merchant);
      if (merchantCategory) return merchantCategory;
    }
    
    // Check transaction category mappings
    if (category) {
      const txCategory = this.identifyByTransactionCategory(category);
      if (txCategory) return txCategory;
    }
    
    return null;
  }

  /**
   * Identify category by merchant name
   */
  private identifyByMerchant(merchant: string): TaxCategory | null {
    const merchantLower = merchant.toLowerCase();
    
    // Common medical merchants
    if (['cvs', 'walgreens', 'rite aid', 'pharmacy'].some(m => merchantLower.includes(m))) {
      return this.categories.find(c => c.id === 'medical') || null;
    }
    
    // Common charitable organizations
    if (['red cross', 'united way', 'goodwill', 'salvation army'].some(m => merchantLower.includes(m))) {
      return this.categories.find(c => c.id === 'charitable') || null;
    }
    
    return null;
  }

  /**
   * Identify by transaction category
   */
  private identifyByTransactionCategory(category: string): TaxCategory | null {
    const categoryLower = category.toLowerCase();
    
    const categoryMap: Record<string, string> = {
      'healthcare': 'medical',
      'medical': 'medical',
      'charity': 'charitable',
      'donations': 'charitable',
      'education': 'education',
      'taxes': 'state-income-tax',
      'mortgage': 'mortgage-interest',
      'business': 'business-expenses'
    };
    
    const taxCategoryId = categoryMap[categoryLower];
    if (taxCategoryId) {
      return this.categories.find(c => c.id === taxCategoryId) || null;
    }
    
    return null;
  }

  /**
   * Get all tax categories
   */
  getCategories(): TaxCategory[] {
    return [...this.categories];
  }

  /**
   * Add custom tax category
   */
  addCategory(category: TaxCategory): void {
    this.categories.push(category);
  }

  /**
   * Update category
   */
  updateCategory(id: string, updates: Partial<TaxCategory>): boolean {
    const index = this.categories.findIndex(c => c.id === id);
    if (index === -1) return false;
    
    this.categories[index] = {
      ...this.categories[index],
      ...updates,
      id
    };
    
    return true;
  }

  /**
   * Remove category
   */
  removeCategory(id: string): boolean {
    const index = this.categories.findIndex(c => c.id === id);
    if (index === -1) return false;
    
    this.categories.splice(index, 1);
    return true;
  }
}

export const taxCategoryService = new TaxCategoryService();