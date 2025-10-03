// Define SearchResult locally since it's not exported from types
export interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  matchedFields?: string[];
  amount?: number;
  metadata?: any;
}

export class VirtualizedSearchService {
  /**
   * Group search results by type
   */
  static groupResultsByType(
    results: SearchResult[]
  ): (SearchResult | { isHeader: true; type: string; count: number })[] {
    const grouped = results.reduce((acc, result) => {
      if (!acc[result.type]) acc[result.type] = [];
      acc[result.type].push(result);
      return acc;
    }, {} as Record<string, SearchResult[]>);

    const flattened: (SearchResult | { isHeader: true; type: string; count: number })[] = [];
    
    Object.entries(grouped).forEach(([type, items]) => {
      flattened.push({ isHeader: true, type, count: items.length } as any);
      flattened.push(...items);
    });

    return flattened;
  }

  /**
   * Get label for result type
   */
  static getTypeLabel(type: string, count?: number): string {
    const labels: Record<string, string> = {
      transaction: 'Transactions',
      account: 'Accounts',
      category: 'Categories',
      budget: 'Budgets',
      goal: 'Goals',
      report: 'Reports'
    };
    const label = labels[type] || type;
    return count ? `${label} (${count})` : label;
  }

  /**
   * Format currency amount
   */
  static formatAmount(amount: number, compact = false): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: compact ? 0 : 2,
      maximumFractionDigits: compact ? 0 : 2
    }).format(amount);
  }

  /**
   * Format date for display
   */
  static formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  /**
   * Calculate item height based on content
   */
  static calculateItemHeight(
    item: SearchResult | { isHeader: true },
    isExpanded: boolean
  ): number {
    if ('isHeader' in item && item.isHeader) return 44;
    
    const result = item as SearchResult;
    let height = 80; // Base height
    
    if (result.subtitle) height += 20;
    if (result.description) {
      height += isExpanded 
        ? Math.min(result.description.length / 2, 100) 
        : 40;
    }
    if (result.matchedFields?.length) height += 30;
    
    return height;
  }

  /**
   * Get icon color for result type
   */
  static getIconColor(type: string): string {
    const colors: Record<string, string> = {
      transaction: 'text-gray-500',
      account: 'text-green-500',
      category: 'text-purple-500',
      budget: 'text-orange-500',
      goal: 'text-indigo-500',
      report: 'text-gray-500'
    };
    return colors[type] || 'text-gray-400';
  }

  /**
   * Parse search query for advanced features
   */
  static parseSearchQuery(query: string): {
    text: string;
    filters: Record<string, string>;
    dateRange?: { from: Date; to: Date };
  } {
    const filters: Record<string, string> = {};
    let text = query;

    // Extract type filter (type:transaction)
    const typeMatch = query.match(/type:(\w+)/i);
    if (typeMatch) {
      filters.type = typeMatch[1];
      text = text.replace(typeMatch[0], '').trim();
    }

    // Extract amount filter (amount:>100)
    const amountMatch = query.match(/amount:([<>]=?\d+(?:\.\d+)?)/i);
    if (amountMatch) {
      filters.amount = amountMatch[1];
      text = text.replace(amountMatch[0], '').trim();
    }

    // Extract date range (from:2024-01-01 to:2024-12-31)
    const fromMatch = query.match(/from:(\d{4}-\d{2}-\d{2})/i);
    const toMatch = query.match(/to:(\d{4}-\d{2}-\d{2})/i);
    
    let dateRange;
    if (fromMatch || toMatch) {
      dateRange = {
        from: fromMatch ? new Date(fromMatch[1]) : new Date('1900-01-01'),
        to: toMatch ? new Date(toMatch[1]) : new Date()
      };
      if (fromMatch) text = text.replace(fromMatch[0], '').trim();
      if (toMatch) text = text.replace(toMatch[0], '').trim();
    }

    return { text, filters, dateRange };
  }

  /**
   * Score search results by relevance
   */
  static scoreResults(results: SearchResult[], query: string): SearchResult[] {
    const queryLower = query.toLowerCase();
    
    return results.map(result => {
      let score = 0;
      
      // Title match (highest weight)
      if (result.title.toLowerCase().includes(queryLower)) {
        score += result.title.toLowerCase() === queryLower ? 100 : 50;
      }
      
      // Subtitle match
      if (result.subtitle?.toLowerCase().includes(queryLower)) {
        score += 30;
      }
      
      // Description match
      if (result.description?.toLowerCase().includes(queryLower)) {
        score += 20;
      }
      
      // Matched fields bonus
      if (result.matchedFields?.length) {
        score += result.matchedFields.length * 10;
      }
      
      return {
        ...result,
        relevanceScore: Math.min(score / 100, 1)
      };
    }).sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }

  /**
   * Filter results based on advanced query
   */
  static filterResults(
    results: SearchResult[],
    query: string
  ): SearchResult[] {
    const { text, filters, dateRange } = this.parseSearchQuery(query);
    
    let filtered = results;
    
    // Apply type filter
    if (filters.type) {
      filtered = filtered.filter(r => r.type === filters.type);
    }
    
    // Apply amount filter
    if (filters.amount) {
      const match = filters.amount.match(/([<>]=?)(\d+(?:\.\d+)?)/);
      if (match) {
        const operator = match[1];
        const value = parseFloat(match[2]);
        
        filtered = filtered.filter(r => {
          if (r.amount === undefined) return false;
          
          switch (operator) {
            case '>': return r.amount > value;
            case '>=': return r.amount >= value;
            case '<': return r.amount < value;
            case '<=': return r.amount <= value;
            default: return r.amount === value;
          }
        });
      }
    }
    
    // Apply date range filter
    if (dateRange) {
      filtered = filtered.filter(r => {
        if (!r.metadata?.date) return false;
        const date = new Date(r.metadata.date);
        return date >= dateRange.from && date <= dateRange.to;
      });
    }
    
    // Apply text search
    if (text) {
      filtered = this.scoreResults(filtered, text);
    }
    
    return filtered;
  }
}