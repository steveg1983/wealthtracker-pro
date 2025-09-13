import type { DecimalInstance } from '../../utils/decimal';

export interface Bill {
  id: string;
  name: string;
  amount: DecimalInstance;
  dueDate: Date;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | 'one-time';
  category: string;
  accountId: string;
  isAutoPay: boolean;
  isActive: boolean;
  reminderDays: number;
  notes?: string;
  paymentHistory: BillPayment[];
  createdAt: Date;
  nextDueDate: Date;
}

export interface BillPayment {
  id: string;
  billId: string;
  amount: DecimalInstance;
  paidDate: Date;
  dueDate: Date;
  isPaid: boolean;
  isLate: boolean;
  lateFee?: DecimalInstance;
  transactionId?: string;
  notes?: string;
}