export interface TransactionFormData {
  date: string;
  description: string;
  amount: string;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  accountId: string;
  notes: string;
  tags: string[];
  cleared: boolean;
}

export interface FormErrors {
  date?: string;
  description?: string;
  amount?: string;
  category?: string;
  account?: string;
}

/**
 * Service for transaction form operations
 */
export class TransactionFormService {
  /**
   * Get initial form data
   */
  static getInitialFormData(defaultAccountId: string): TransactionFormData {
    return {
      date: new Date().toISOString().split('T')[0],
      description: '',
      amount: '',
      type: 'expense',
      category: '',
      accountId: defaultAccountId,
      notes: '',
      tags: [],
      cleared: false
    };
  }

  /**
   * Validate a single field
   */
  static validateField(name: string, value: unknown): string | undefined {
    switch (name) {
      case 'date':
        if (!value) return 'Date is required';
        break;
      case 'description': {
        const strValue = String(value || '');
        if (!strValue || strValue.trim() === '') return 'Description is required';
        if (strValue.length < 2) return 'Description must be at least 2 characters';
        break;
      }
      case 'amount': {
        if (!value) return 'Amount is required';
        const amount = parseFloat(String(value));
        if (isNaN(amount) || amount <= 0) return 'Amount must be a positive number';
        break;
      }
      case 'category':
        if (!value) return 'Category is required';
        break;
      case 'account':
        if (!value) return 'Account is required';
        break;
    }
    return undefined;
  }

  /**
   * Validate entire form
   */
  static validateForm(formData: TransactionFormData): {
    isValid: boolean;
    errors: FormErrors;
  } {
    const errors: FormErrors = {};
    
    errors.date = this.validateField('date', formData.date);
    errors.description = this.validateField('description', formData.description);
    errors.amount = this.validateField('amount', formData.amount);
    errors.category = this.validateField('category', formData.category);
    errors.account = this.validateField('account', formData.accountId);
    
    const isValid = !Object.values(errors).some(error => error !== undefined);
    
    return { isValid, errors };
  }

  /**
   * Get focusable elements selector
   */
  static getFocusableElementsSelector(): string {
    return 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  }

  /**
   * Handle focus trap for modal
   */
  static handleFocusTrap(
    e: KeyboardEvent,
    modalRef: HTMLDivElement | null
  ): void {
    if (e.key !== 'Tab' || !modalRef) return;

    const focusableElements = modalRef.querySelectorAll(
      this.getFocusableElementsSelector()
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }

  /**
   * Create screen reader announcement for errors
   */
  static announceErrors(errors: FormErrors): void {
    const errorMessages = Object.values(errors).filter(Boolean).join('. ');
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'alert');
    announcement.setAttribute('aria-live', 'assertive');
    announcement.className = 'sr-only';
    announcement.textContent = `Form has errors: ${errorMessages}`;
    document.body.appendChild(announcement);
    setTimeout(() => announcement.remove(), 1000);
  }

  /**
   * Convert form data for submission
   */
  static prepareFormDataForSubmission(formData: TransactionFormData) {
    return {
      ...formData,
      date: new Date(formData.date),
      amount: parseFloat(formData.amount)
    };
  }

  /**
   * Initialize form data from existing transaction
   */
  static initializeFromTransaction(transaction: any): TransactionFormData {
    return {
      date: new Date(transaction.date).toISOString().split('T')[0],
      description: transaction.description,
      amount: transaction.amount.toString(),
      type: transaction.type,
      category: transaction.category,
      accountId: transaction.accountId,
      notes: transaction.notes || '',
      tags: transaction.tags || [],
      cleared: transaction.cleared || false
    };
  }
}