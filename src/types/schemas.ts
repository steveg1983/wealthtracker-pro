import { z } from 'zod';

// Minimal input schemas matching create operations in SupabaseService

export const AccountCreateSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['current', 'savings', 'credit', 'loan', 'investment', 'asset', 'mortgage', 'assets', 'other', 'checking']).optional(),
  balance: z.number().optional(),
  currency: z.string().min(1).optional(),
  institution: z.string().optional(),
});
export type AccountCreate = z.infer<typeof AccountCreateSchema>;

export const TransactionCreateSchema = z.object({
  accountId: z.string().min(1),
  date: z.union([z.string(), z.date()]),
  description: z.string().min(1),
  amount: z.number(),
  type: z.enum(['income', 'expense']).optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
export type TransactionCreate = z.infer<typeof TransactionCreateSchema>;

export const BudgetCreateSchema = z.object({
  name: z.string().optional(),
  category: z.string().min(1),
  amount: z.number(),
  period: z.enum(['monthly', 'yearly']).optional(),
  startDate: z.union([z.string(), z.date()]).optional(),
});
export type BudgetCreate = z.infer<typeof BudgetCreateSchema>;

export const GoalCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  targetAmount: z.number(),
  currentAmount: z.number().optional(),
  targetDate: z.union([z.string(), z.date()]),
  category: z.string().optional(),
});
export type GoalCreate = z.infer<typeof GoalCreateSchema>;

