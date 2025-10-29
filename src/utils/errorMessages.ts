/**
 * User-friendly error messages utility
 * Converts technical errors into helpful, actionable messages for users
 */

// Map of technical error codes/messages to user-friendly messages
const errorMessageMap: Record<string, string> = {
  // Validation errors
  'required': 'This field is required',
  'Description is required': 'Please enter a description for this transaction',
  'Amount must be greater than 0': 'Please enter a valid amount greater than zero',
  'Category is required': 'Please select a category for this transaction',
  'Invalid account ID': 'Please select a valid account',
  'Date must be in YYYY-MM-DD format': 'Please enter a valid date',
  'Invalid decimal number': 'Please enter a valid number (e.g., 10.50)',
  'Notes must be less than 1000 characters': 'Your notes are too long. Please keep them under 1000 characters',
  'Description must be less than 500 characters': 'Description is too long. Please keep it under 500 characters',
  
  // Account errors
  'Account not found': 'The selected account no longer exists. Please refresh and try again',
  'Insufficient balance': 'This account doesn\'t have enough funds for this transaction',
  'Account is locked': 'This account is currently locked. Please unlock it in Account Settings',
  
  // Network errors
  'NetworkError': 'Connection problem. Please check your internet and try again',
  'Failed to fetch': 'Unable to connect to the server. Please try again',
  'Network request failed': 'Connection lost. Your changes will be saved when you\'re back online',
  'timeout': 'This is taking longer than expected. Please try again',
  
  // Auth errors
  'Unauthorized': 'Your session has expired. Please sign in again',
  'Forbidden': 'You don\'t have permission to perform this action',
  'Invalid credentials': 'The email or password you entered is incorrect',
  'Email already exists': 'An account with this email already exists',
  
  // Database errors
  'unique constraint': 'This item already exists. Please use a different name',
  'foreign key constraint': 'This item is being used elsewhere and cannot be deleted',
  'SQLITE_BUSY': 'The database is busy. Please wait a moment and try again',
  
  // File errors
  'File too large': 'This file is too large. Please choose a file under 5MB',
  'Invalid file type': 'This file type is not supported. Please use JPG, PNG, or PDF',
  'Upload failed': 'Unable to upload the file. Please try again',
  
  // General errors
  'Something went wrong': 'An unexpected error occurred. Please try again',
  'Invalid input': 'Please check your input and try again',
  'Operation failed': 'Unable to complete this action. Please try again',
};

/**
 * Get a user-friendly error message
 */
export function getUserFriendlyError(error: unknown): string {
  // Handle string errors
  if (typeof error === 'string') {
    // Check if we have a friendly version
    for (const [key, friendlyMessage] of Object.entries(errorMessageMap)) {
      if (error.toLowerCase().includes(key.toLowerCase())) {
        return friendlyMessage;
      }
    }
    return error;
  }
  
  // Handle Error objects
  if (error instanceof Error) {
    const message = error.message;
    
    // Check for specific error types
    if (error.name === 'NetworkError' || message.includes('fetch')) {
      return errorMessageMap['NetworkError'];
    }
    
    // Check if we have a friendly version of the message
    for (const [key, friendlyMessage] of Object.entries(errorMessageMap)) {
      if (message.toLowerCase().includes(key.toLowerCase())) {
        return friendlyMessage;
      }
    }
    
    // If it's a generic error, provide a helpful message
    if (message.length > 100) {
      return 'An error occurred. Please try again or contact support if the problem persists.';
    }
    
    return message;
  }
  
  // Handle validation error objects (from form validation)
  if (typeof error === 'object' && error !== null && 'field' in error) {
    const validationError = error as { field: string; message: string };
    return errorMessageMap[validationError.message] || validationError.message;
  }
  
  // Default fallback
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Format field-specific errors for forms
 */
export function formatFieldError(fieldName: string, errorMessage: string): string {
  const fieldLabels: Record<string, string> = {
    description: 'Description',
    amount: 'Amount',
    date: 'Date',
    category: 'Category',
    accountId: 'Account',
    notes: 'Notes',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
  };
  
  const label = fieldLabels[fieldName] || fieldName;
  
  // If the error message already mentions the field, don't duplicate
  if (errorMessage.toLowerCase().includes(fieldName.toLowerCase())) {
    return getUserFriendlyError(errorMessage);
  }
  
  // Otherwise, prepend the field label
  return `${label}: ${getUserFriendlyError(errorMessage)}`;
}

/**
 * Create an error summary for multiple validation errors
 */
export function createErrorSummary(errors: Record<string, string>): string {
  const errorCount = Object.keys(errors).length;
  
  if (errorCount === 0) return '';
  if (errorCount === 1) {
    return Object.values(errors)[0];
  }
  
  return `Please fix ${errorCount} errors before continuing`;
}

/**
 * Get action suggestion based on error type
 */
export function getErrorAction(error: string): string | null {
  const actionMap: Record<string, string> = {
    'session has expired': 'Sign in again',
    'connection problem': 'Check connection',
    'try again': 'Retry',
    'contact support': 'Get help',
  };
  
  const lowerError = error.toLowerCase();
  for (const [key, action] of Object.entries(actionMap)) {
    if (lowerError.includes(key)) {
      return action;
    }
  }
  
  return null;
}

/**
 * Format error for toast/notification display
 */
export interface ErrorNotification {
  title: string;
  message: string;
  action?: string;
  type: 'error' | 'warning' | 'info';
}

export function formatErrorNotification(error: unknown): ErrorNotification {
  const message = getUserFriendlyError(error);
  const action = getErrorAction(message);
  
  // Determine severity
  let type: 'error' | 'warning' | 'info' = 'error';
  if (message.includes('connection') || message.includes('offline')) {
    type = 'warning';
  } else if (message.includes('session') || message.includes('sign in')) {
    type = 'info';
  }
  
  // Create appropriate title
  let title = 'Error';
  if (type === 'warning') title = 'Connection Issue';
  if (type === 'info') title = 'Action Required';
  
  return {
    title,
    message,
    action: action || undefined,
    type
  };
}