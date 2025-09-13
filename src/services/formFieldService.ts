/**
 * Form Field Service
 * Business logic for form field components
 */

export class FormFieldService {
  /**
   * Build aria-describedby attribute from multiple IDs
   */
  static buildAriaDescribedBy(ids: (string | undefined)[]): string | undefined {
    const validIds = ids.filter(Boolean);
    return validIds.length > 0 ? validIds.join(' ') : undefined;
  }

  /**
   * Generate field IDs for accessibility
   */
  static generateFieldIds(baseId: string) {
    return {
      fieldId: baseId,
      errorId: `${baseId}-error`,
      hintId: `${baseId}-hint`,
      successId: `${baseId}-success`
    };
  }

  /**
   * Get field state classes based on validation
   */
  static getFieldStateClasses(error?: string, success?: string): string {
    if (error) {
      return 'border-red-500 focus:border-red-500 focus:ring-red-500';
    }
    if (success) {
      return 'border-green-500 focus:border-green-500 focus:ring-green-500';
    }
    return '';
  }

  /**
   * Get base input classes
   */
  static getBaseInputClasses(
    leftIcon?: boolean,
    rightIcon?: boolean,
    error?: string
  ): string {
    return `
      block w-full rounded-lg border-gray-300 dark:border-gray-600
      dark:bg-gray-700 dark:text-white
      shadow-sm transition-colors
      focus:border-gray-500 focus:ring-gray-500
      disabled:bg-gray-100 dark:disabled:bg-gray-800
      disabled:cursor-not-allowed
      ${leftIcon ? 'pl-10' : 'pl-3'}
      ${rightIcon ? 'pr-10' : 'pr-3'}
      py-2
      ${this.getFieldStateClasses(error)}
    `.trim();
  }

  /**
   * Get base select classes
   */
  static getBaseSelectClasses(error?: string): string {
    return `
      block w-full rounded-lg border-gray-300 dark:border-gray-600
      dark:bg-gray-700 dark:text-white
      shadow-sm transition-colors
      focus:border-gray-500 focus:ring-gray-500
      disabled:bg-gray-100 dark:disabled:bg-gray-800
      disabled:cursor-not-allowed
      px-3 py-2
      ${this.getFieldStateClasses(error)}
    `.trim();
  }

  /**
   * Get base textarea classes
   */
  static getBaseTextareaClasses(error?: string): string {
    return `
      block w-full rounded-lg border-gray-300 dark:border-gray-600
      dark:bg-gray-700 dark:text-white
      shadow-sm transition-colors
      focus:border-gray-500 focus:ring-gray-500
      disabled:bg-gray-100 dark:disabled:bg-gray-800
      disabled:cursor-not-allowed
      px-3 py-2
      ${this.getFieldStateClasses(error)}
    `.trim();
  }

  /**
   * Get checkbox classes
   */
  static getCheckboxClasses(error?: string): string {
    return `
      h-4 w-4 mt-0.5
      text-gray-600 
      border-gray-300 dark:border-gray-600
      rounded
      focus:ring-gray-500
      disabled:opacity-50 disabled:cursor-not-allowed
      ${error ? 'border-red-500' : ''}
    `.trim();
  }

  /**
   * Get radio button classes
   */
  static getRadioClasses(): string {
    return `
      h-4 w-4 mt-0.5 
      text-gray-600 
      border-gray-300 
      focus:ring-gray-500 
      disabled:opacity-50 
      disabled:cursor-not-allowed
    `.trim();
  }

  /**
   * Validate required field
   */
  static validateRequired(value: any, required?: boolean): string | undefined {
    if (required && !value) {
      return 'This field is required';
    }
    return undefined;
  }

  /**
   * Validate email format
   */
  static validateEmail(email: string): string | undefined {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address';
    }
    return undefined;
  }

  /**
   * Validate minimum length
   */
  static validateMinLength(value: string, minLength: number): string | undefined {
    if (value.length < minLength) {
      return `Must be at least ${minLength} characters`;
    }
    return undefined;
  }

  /**
   * Validate maximum length
   */
  static validateMaxLength(value: string, maxLength: number): string | undefined {
    if (value.length > maxLength) {
      return `Must be no more than ${maxLength} characters`;
    }
    return undefined;
  }

  /**
   * Validate number range
   */
  static validateNumberRange(
    value: number,
    min?: number,
    max?: number
  ): string | undefined {
    if (min !== undefined && value < min) {
      return `Must be at least ${min}`;
    }
    if (max !== undefined && value > max) {
      return `Must be no more than ${max}`;
    }
    return undefined;
  }

  /**
   * Format validation errors for display
   */
  static formatValidationErrors(errors: string[]): string {
    if (errors.length === 0) return '';
    if (errors.length === 1) return errors[0];
    return errors.join(', ');
  }
}