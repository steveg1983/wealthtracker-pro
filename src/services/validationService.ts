import { z } from 'zod';
import { 
  sanitizeText, 
  sanitizeNumber, 
  sanitizeDecimal, 
  sanitizeDate,
  sanitizeFilename,
  sanitizeQuery,
  sanitizeMarkdown
} from '../security/xss-protection';
import Decimal from 'decimal.js';

type DecimalType = InstanceType<typeof Decimal>;

// Custom Zod refinement for Decimal values
const decimalString = z.string().refine(
  (val) => {
    try {
      new Decimal(val);
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Invalid decimal number' }
);

// Transaction validation schemas
export const transactionSchema = z.object({
  id: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  description: z.string()
    .min(1, 'Description is required')
    .max(500, 'Description must be less than 500 characters')
    .transform(val => sanitizeText(val.trim())),
  amount: decimalString.refine(
    (val) => new Decimal(val).abs().gt(0),
    { message: 'Amount must be greater than 0' }
  ),
  type: z.enum(['income', 'expense']),
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().optional(),
  accountId: z.string().uuid('Invalid account ID'),
  tags: z.array(z.string().transform(tag => sanitizeText(tag))).optional(),
  notes: z.string()
    .max(1000, 'Notes must be less than 1000 characters')
    .transform(val => val ? sanitizeMarkdown(val) : val)
    .optional(),
  attachments: z.array(z.string()).optional(),
  isRecurring: z.boolean().optional(),
  recurringId: z.string().uuid().optional(),
  location: z.object({
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    address: z.string().optional()
  }).optional(),
  merchant: z.string().max(200, 'Merchant name must be less than 200 characters').optional(),
  paymentMethod: z.enum(['cash', 'credit', 'debit', 'transfer', 'check', 'other']).optional(),
  status: z.enum(['pending', 'cleared', 'reconciled']).optional(),
  taxDeductible: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

// Account validation schemas
export const accountSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string()
    .min(1, 'Account name is required')
    .max(100, 'Account name must be less than 100 characters')
    .transform(val => sanitizeText(val.trim())),
  type: z.enum(['checking', 'savings', 'credit_card', 'investment', 'loan', 'asset', 'other']),
  balance: decimalString,
  currency: z.string()
    .length(3, 'Currency must be a 3-letter code')
    .toUpperCase()
    .default('USD'),
  institution: z.string()
    .max(200, 'Institution name must be less than 200 characters')
    .transform(val => val ? sanitizeText(val) : val)
    .optional(),
  accountNumber: z.string()
    .max(50, 'Account number must be less than 50 characters')
    .transform(val => val ? sanitizeText(val) : val)
    .optional(),
  isActive: z.boolean().default(true),
  color: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex code')
    .optional(),
  notes: z.string()
    .max(1000, 'Notes must be less than 1000 characters')
    .transform(val => val ? sanitizeMarkdown(val) : val)
    .optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

// Budget validation schemas
export const budgetSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string()
    .min(1, 'Budget name is required')
    .max(100, 'Budget name must be less than 100 characters')
    .transform(val => sanitizeText(val.trim())),
  category: z.string().min(1, 'Category is required'),
  amount: decimalString.refine(
    (val) => new Decimal(val).gte(0),
    { message: 'Budget amount must be non-negative' }
  ),
  period: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
  endDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format')
    .optional(),
  alertThreshold: z.number()
    .min(0, 'Alert threshold must be between 0 and 100')
    .max(100, 'Alert threshold must be between 0 and 100')
    .optional(),
  notes: z.string()
    .max(1000, 'Notes must be less than 1000 characters')
    .optional(),
  isActive: z.boolean().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

// Goal validation schemas
export const goalSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string()
    .min(1, 'Goal name is required')
    .max(100, 'Goal name must be less than 100 characters')
    .transform(val => val.trim()),
  targetAmount: decimalString.refine(
    (val) => new Decimal(val).gt(0),
    { message: 'Target amount must be greater than 0' }
  ),
  currentAmount: decimalString.default('0'),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Target date must be in YYYY-MM-DD format'),
  category: z.enum(['emergency_fund', 'vacation', 'home', 'car', 'education', 'retirement', 'other']),
  priority: z.enum(['low', 'medium', 'high']),
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  isActive: z.boolean().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

// Category validation schemas
export const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string()
    .min(1, 'Category name is required')
    .max(50, 'Category name must be less than 50 characters')
    .transform(val => val.trim()),
  type: z.enum(['income', 'expense', 'both']),
  color: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex code')
    .optional(),
  icon: z.string()
    .max(50, 'Icon name must be less than 50 characters')
    .optional(),
  parentId: z.string().uuid().optional(),
  isActive: z.boolean().default(true),
  order: z.number().int().min(0).optional()
});

// Tag validation schema
export const tagSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string()
    .min(1, 'Tag name is required')
    .max(30, 'Tag name must be less than 30 characters')
    .transform(val => val.trim().toLowerCase()),
  color: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex code')
    .optional()
});

// Import data validation schemas
export const csvImportRowSchema = z.object({
  date: z.string(),
  description: z.string(),
  amount: z.string(),
  category: z.string().optional(),
  accountName: z.string().optional(),
  notes: z.string().optional(),
  tags: z.string().optional()
});

// Settings validation schemas
export const currencySettingsSchema = z.object({
  defaultCurrency: z.string()
    .length(3, 'Currency must be a 3-letter code')
    .toUpperCase(),
  numberFormat: z.enum(['1,234.56', '1.234,56', '1 234.56', '1 234,56']),
  showCurrencySymbol: z.boolean()
});

export const notificationSettingsSchema = z.object({
  emailNotifications: z.boolean(),
  pushNotifications: z.boolean(),
  budgetAlerts: z.boolean(),
  goalReminders: z.boolean(),
  billReminders: z.boolean(),
  alertThreshold: z.number().min(0).max(100)
});

// Email validation
export const emailSchema = z.string()
  .email('Invalid email address')
  .max(255, 'Email must be less than 255 characters');

// Password validation
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password must be less than 100 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

// Validation helper functions
export class ValidationService {
  static validateTransaction(data: unknown): z.infer<typeof transactionSchema> {
    return transactionSchema.parse(data);
  }

  static validateAccount(data: unknown): z.infer<typeof accountSchema> {
    return accountSchema.parse(data);
  }

  static validateBudget(data: unknown): z.infer<typeof budgetSchema> {
    return budgetSchema.parse(data);
  }

  static validateGoal(data: unknown): z.infer<typeof goalSchema> {
    return goalSchema.parse(data);
  }

  static validateCategory(data: unknown): z.infer<typeof categorySchema> {
    return categorySchema.parse(data);
  }

  static validateTag(data: unknown): z.infer<typeof tagSchema> {
    return tagSchema.parse(data);
  }

  static validateCsvImportRow(data: unknown): z.infer<typeof csvImportRowSchema> {
    return csvImportRowSchema.parse(data);
  }

  static validateEmail(email: unknown): string {
    return emailSchema.parse(email);
  }

  static validatePassword(password: unknown): string {
    return passwordSchema.parse(password);
  }

  // Safe validation that returns errors instead of throwing
  static safeValidate<T>(
    schema: z.ZodSchema<T>,
    data: unknown
  ): { success: true; data: T } | { success: false; errors: z.ZodError } {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return { success: false, errors: result.error };
    }
  }

  // Format Zod errors for display
  static formatErrors(error: z.ZodError): Record<string, string> {
    const formatted: Record<string, string> = {};
    error.issues.forEach((err: z.ZodIssue) => {
      const path = err.path.join('.');
      formatted[path] = err.message;
    });
    return formatted;
  }

  // Sanitize input strings using DOMPurify
  static sanitizeString(input: string, maxLength: number = 1000): string {
    // Use the robust XSS protection
    const sanitized = sanitizeText(input);
    return sanitized.substring(0, maxLength);
  }

  // Validate and sanitize file names
  static validateFileName(fileName: string): string {
    const sanitized = sanitizeFilename(fileName);
    
    if (!sanitized || sanitized === '.' || sanitized === '..') {
      throw new Error('Invalid file name');
    }
    
    return sanitized;
  }

  // Validate date range
  static validateDateRange(startDate: string, endDate: string): boolean {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format');
    }
    
    if (start > end) {
      throw new Error('Start date must be before end date');
    }
    
    return true;
  }

  // Validate monetary amount
  static validateAmount(amount: string | number): DecimalType {
    try {
      const decimal = new Decimal(amount);
      if (decimal.isNaN() || !decimal.isFinite()) {
        throw new Error('Invalid amount');
      }
      return decimal;
    } catch {
      throw new Error('Invalid amount format');
    }
  }
}

export default ValidationService;

// Export instance for easier testing
export const validationService = new ValidationService();