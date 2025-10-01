// Type definitions for business service saved data

export interface SavedInvoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  issueDate: string;
  dueDate: string;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
    total: number;
  }>;
  subtotal: number;
  vatAmount: number;
  total: number;
  status: string;
  notes?: string;
  paymentTerms: string;
  createdAt: string;
  paidAt?: string;
}

export interface SavedMileageEntry {
  id: string;
  date: string;
  startLocation: string;
  endLocation: string;
  distance: number;
  purpose: string;
  rate: number;
  amount: number;
  category: string;
  notes?: string;
  createdAt: string;
}

export interface SavedBusinessExpense {
  id: string;
  transactionId?: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  vatAmount?: number;
  isDeductible: boolean;
  receiptUrl?: string;
  notes?: string;
  createdAt: string;
}