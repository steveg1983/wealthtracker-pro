export interface QuickExpenseData {
  amount: string;
  description: string;
  category: string;
  date: Date;
  account: string;
  payee?: string;
  tags?: string[];
  receipt?: File;
}

export class QuickExpenseCaptureService {
  static createDefaultExpense(): QuickExpenseData {
    return {
      amount: '',
      description: '',
      category: '',
      date: new Date(),
      account: '',
      payee: '',
      tags: [],
      receipt: undefined
    };
  }

  static parseAmount(input: string): number {
    const cleaned = input.replace(/[^0-9.-]/g, '');
    const amount = parseFloat(cleaned);
    return isNaN(amount) ? 0 : amount;
  }

  static formatAmountForDisplay(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  }

  static validateExpense(expense: QuickExpenseData): string[] {
    const errors: string[] = [];
    
    if (!expense.amount || this.parseAmount(expense.amount) <= 0) {
      errors.push('Amount is required and must be greater than 0');
    }
    
    if (!expense.description.trim()) {
      errors.push('Description is required');
    }
    
    if (!expense.category) {
      errors.push('Category is required');
    }
    
    if (!expense.account) {
      errors.push('Account is required');
    }
    
    return errors;
  }

  static suggestCategory(description: string, previousTransactions: Array<{ payee?: string; description?: string }>): string {
    const keywords = {
      'grocery': ['grocery', 'supermarket', 'food', 'walmart', 'target'],
      'dining': ['restaurant', 'cafe', 'coffee', 'pizza', 'burger'],
      'transport': ['gas', 'uber', 'lyft', 'parking', 'transit'],
      'utilities': ['electric', 'water', 'internet', 'phone', 'cable'],
      'entertainment': ['movie', 'netflix', 'spotify', 'game', 'concert']
    };
    
    const lowerDesc = description.toLowerCase();
    
    for (const [category, words] of Object.entries(keywords)) {
      if (words.some(word => lowerDesc.includes(word))) {
        return category;
      }
    }
    
    return '';
  }

  static getRecentPayees(transactions: Array<{ payee?: string }>, limit: number = 10): string[] {
    const payees = new Map<string, number>();
    
    transactions.forEach(t => {
      if (t.payee) {
        payees.set(t.payee, (payees.get(t.payee) || 0) + 1);
      }
    });
    
    return Array.from(payees.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([payee]) => payee);
  }

  static saveToLocalStorage(expense: QuickExpenseData): void {
    const recentExpenses = this.getRecentExpenses();
    recentExpenses.unshift(expense);
    
    if (recentExpenses.length > 10) {
      recentExpenses.pop();
    }
    
    localStorage.setItem('quickExpenses', JSON.stringify(recentExpenses));
  }

  static getRecentExpenses(): QuickExpenseData[] {
    const stored = localStorage.getItem('quickExpenses');
    return stored ? JSON.parse(stored) : [];
  }
}