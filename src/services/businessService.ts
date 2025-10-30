import Decimal from 'decimal.js';
import type { Transaction, Account } from '../types';
import type { SavedInvoice, SavedMileageEntry, SavedBusinessExpense } from '../types/business';

export interface VATRate {
  id: string;
  name: string;
  rate: number; // As decimal (e.g., 0.20 for 20%)
  isDefault: boolean;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  issueDate: Date;
  dueDate: Date;
  items: InvoiceItem[];
  subtotal: number;
  vatAmount: number;
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  notes?: string;
  paymentTerms: string;
  createdAt: Date;
  paidAt?: Date;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  total: number;
}

export interface MileageEntry {
  id: string;
  date: Date;
  startLocation: string;
  endLocation: string;
  distance: number; // in miles
  purpose: string;
  rate: number; // per mile
  amount: number;
  category: 'business' | 'medical' | 'charitable' | 'moving';
  notes?: string;
  createdAt: Date;
}

export interface BusinessExpense {
  id: string;
  transactionId?: string;
  date: Date;
  description: string;
  amount: number;
  category: BusinessExpenseCategory;
  vatAmount?: number;
  isDeductible: boolean;
  receiptUrl?: string;
  notes?: string;
  createdAt: Date;
}

export type BusinessExpenseCategory = 
  | 'office_supplies'
  | 'travel'
  | 'meals'
  | 'utilities'
  | 'rent'
  | 'marketing'
  | 'professional_services'
  | 'equipment'
  | 'software'
  | 'insurance'
  | 'other';

export interface BusinessMetrics {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  outstandingInvoices: number;
  overdueInvoices: number;
  averagePaymentTime: number;
  topExpenseCategories: Array<{
    category: BusinessExpenseCategory;
    amount: number;
    percentage: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    revenue: number;
    expenses: number;
    profit: number;
  }>;
}

class BusinessService {
  private vatRates: VATRate[] = [
    { id: '1', name: 'Standard Rate', rate: 0.20, isDefault: true },
    { id: '2', name: 'Reduced Rate', rate: 0.05, isDefault: false },
    { id: '3', name: 'Zero Rate', rate: 0.00, isDefault: false }
  ];

  private invoices: Invoice[] = [];
  private mileageEntries: MileageEntry[] = [];
  private businessExpenses: BusinessExpense[] = [];

  constructor() {
    this.loadData();
    this.createSampleData();
  }

  private loadData() {
    try {
      const savedVATRates = localStorage.getItem('business-vat-rates');
      if (savedVATRates) {
        this.vatRates = JSON.parse(savedVATRates);
      }

      const savedInvoices = localStorage.getItem('business-invoices');
      if (savedInvoices) {
        this.invoices = JSON.parse(savedInvoices).map((invoice: SavedInvoice) => ({
          ...invoice,
          issueDate: new Date(invoice.issueDate),
          dueDate: new Date(invoice.dueDate),
          createdAt: new Date(invoice.createdAt),
          paidAt: invoice.paidAt ? new Date(invoice.paidAt) : undefined
        }));
      }

      const savedMileage = localStorage.getItem('business-mileage');
      if (savedMileage) {
        this.mileageEntries = JSON.parse(savedMileage).map((entry: SavedMileageEntry) => ({
          ...entry,
          date: new Date(entry.date),
          createdAt: new Date(entry.createdAt)
        }));
      }

      const savedExpenses = localStorage.getItem('business-expenses');
      if (savedExpenses) {
        this.businessExpenses = JSON.parse(savedExpenses).map((expense: SavedBusinessExpense) => ({
          ...expense,
          date: new Date(expense.date),
          createdAt: new Date(expense.createdAt)
        }));
      }
    } catch (error) {
      console.error('Error loading business data:', error);
    }
  }

  private saveData() {
    try {
      localStorage.setItem('business-vat-rates', JSON.stringify(this.vatRates));
      localStorage.setItem('business-invoices', JSON.stringify(this.invoices));
      localStorage.setItem('business-mileage', JSON.stringify(this.mileageEntries));
      localStorage.setItem('business-expenses', JSON.stringify(this.businessExpenses));
    } catch (error) {
      console.error('Error saving business data:', error);
    }
  }

  private createSampleData() {
    if (this.invoices.length === 0) {
      // Create sample invoices
      const sampleInvoices: Invoice[] = [
        {
          id: '1',
          invoiceNumber: 'INV-2024-001',
          clientName: 'Acme Corporation',
          clientEmail: 'accounts@acme.com',
          issueDate: new Date('2024-01-15'),
          dueDate: new Date('2024-02-15'),
          items: [
            {
              id: '1',
              description: 'Web Development Services',
              quantity: 40,
              unitPrice: 75,
              vatRate: 0.20,
              total: 3600
            }
          ],
          subtotal: 3000,
          vatAmount: 600,
          total: 3600,
          status: 'paid',
          paymentTerms: 'Net 30',
          notes: 'Thank you for your business!',
          createdAt: new Date('2024-01-15'),
          paidAt: new Date('2024-02-10')
        },
        {
          id: '2',
          invoiceNumber: 'INV-2024-002',
          clientName: 'Tech Solutions Ltd',
          clientEmail: 'billing@techsolutions.com',
          issueDate: new Date('2024-02-01'),
          dueDate: new Date('2024-03-01'),
          items: [
            {
              id: '2',
              description: 'Monthly Maintenance',
              quantity: 1,
              unitPrice: 500,
              vatRate: 0.20,
              total: 600
            }
          ],
          subtotal: 500,
          vatAmount: 100,
          total: 600,
          status: 'sent',
          paymentTerms: 'Net 30',
          createdAt: new Date('2024-02-01')
        }
      ];

      this.invoices = sampleInvoices;
    }

    if (this.mileageEntries.length === 0) {
      // Create sample mileage entries
      const sampleMileage: MileageEntry[] = [
        {
          id: '1',
          date: new Date('2024-01-15'),
          startLocation: 'Office',
          endLocation: 'Client Meeting - Downtown',
          distance: 25,
          purpose: 'Client consultation',
          rate: 0.67, // 2024 IRS rate
          amount: 16.75,
          category: 'business',
          notes: 'Meeting with Acme Corporation',
          createdAt: new Date('2024-01-15')
        },
        {
          id: '2',
          date: new Date('2024-01-20'),
          startLocation: 'Home',
          endLocation: 'Networking Event',
          distance: 15,
          purpose: 'Business networking',
          rate: 0.67,
          amount: 10.05,
          category: 'business',
          createdAt: new Date('2024-01-20')
        }
      ];

      this.mileageEntries = sampleMileage;
    }

    if (this.businessExpenses.length === 0) {
      // Create sample business expenses
      const sampleExpenses: BusinessExpense[] = [
        {
          id: '1',
          date: new Date('2024-01-10'),
          description: 'Office Supplies - Stationery',
          amount: 125.50,
          category: 'office_supplies',
          vatAmount: 25.10,
          isDeductible: true,
          notes: 'Paper, pens, folders',
          createdAt: new Date('2024-01-10')
        },
        {
          id: '2',
          date: new Date('2024-01-15'),
          description: 'Software Subscription - Adobe Creative Suite',
          amount: 52.99,
          category: 'software',
          vatAmount: 10.60,
          isDeductible: true,
          notes: 'Monthly subscription',
          createdAt: new Date('2024-01-15')
        },
        {
          id: '3',
          date: new Date('2024-01-20'),
          description: 'Business Lunch - Client Meeting',
          amount: 85.00,
          category: 'meals',
          vatAmount: 17.00,
          isDeductible: true,
          notes: 'Meeting with Tech Solutions Ltd',
          createdAt: new Date('2024-01-20')
        }
      ];

      this.businessExpenses = sampleExpenses;
    }

    this.saveData();
  }

  // VAT Management
  getVATRates(): VATRate[] {
    return this.vatRates;
  }

  getDefaultVATRate(): VATRate {
    return this.vatRates.find(rate => rate.isDefault) || this.vatRates[0];
  }

  addVATRate(rate: Omit<VATRate, 'id'>): VATRate {
    const newRate: VATRate = {
      ...rate,
      id: Date.now().toString()
    };

    // If this is being set as default, unset others
    if (rate.isDefault) {
      this.vatRates = this.vatRates.map(r => ({ ...r, isDefault: false }));
    }

    this.vatRates.push(newRate);
    this.saveData();
    return newRate;
  }

  updateVATRate(id: string, updates: Partial<VATRate>): VATRate | null {
    const index = this.vatRates.findIndex(rate => rate.id === id);
    if (index === -1) return null;

    // If this is being set as default, unset others
    if (updates.isDefault) {
      this.vatRates = this.vatRates.map(r => ({ ...r, isDefault: false }));
    }

    this.vatRates[index] = { ...this.vatRates[index], ...updates };
    this.saveData();
    return this.vatRates[index];
  }

  deleteVATRate(id: string): boolean {
    const index = this.vatRates.findIndex(rate => rate.id === id);
    if (index === -1) return false;

    this.vatRates.splice(index, 1);
    this.saveData();
    return true;
  }

  // Invoice Management
  getInvoices(): Invoice[] {
    return this.invoices.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getInvoiceById(id: string): Invoice | null {
    return this.invoices.find(invoice => invoice.id === id) || null;
  }

  createInvoice(invoiceData: Omit<Invoice, 'id' | 'createdAt'>): Invoice {
    const newInvoice: Invoice = {
      ...invoiceData,
      id: Date.now().toString(),
      createdAt: new Date()
    };

    this.invoices.push(newInvoice);
    this.saveData();
    return newInvoice;
  }

  updateInvoice(id: string, updates: Partial<Invoice>): Invoice | null {
    const index = this.invoices.findIndex(invoice => invoice.id === id);
    if (index === -1) return null;

    this.invoices[index] = { ...this.invoices[index], ...updates };
    this.saveData();
    return this.invoices[index];
  }

  deleteInvoice(id: string): boolean {
    const index = this.invoices.findIndex(invoice => invoice.id === id);
    if (index === -1) return false;

    this.invoices.splice(index, 1);
    this.saveData();
    return true;
  }

  markInvoiceAsPaid(id: string, paidAt: Date = new Date()): Invoice | null {
    const invoice = this.getInvoiceById(id);
    if (!invoice) return null;

    return this.updateInvoice(id, {
      status: 'paid',
      paidAt
    });
  }

  calculateInvoiceTotals(items: InvoiceItem[]): {
    subtotal: number;
    vatAmount: number;
    total: number;
  } {
    let subtotal = new Decimal(0);
    let vatAmount = new Decimal(0);

    items.forEach(item => {
      const itemSubtotal = new Decimal(item.quantity).times(item.unitPrice);
      const itemVat = itemSubtotal.times(item.vatRate);
      
      subtotal = subtotal.plus(itemSubtotal);
      vatAmount = vatAmount.plus(itemVat);
    });

    const total = subtotal.plus(vatAmount);

    return {
      subtotal: subtotal.toNumber(),
      vatAmount: vatAmount.toNumber(),
      total: total.toNumber()
    };
  }

  // Mileage Tracking
  getMileageEntries(): MileageEntry[] {
    return this.mileageEntries.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  addMileageEntry(entry: Omit<MileageEntry, 'id' | 'amount' | 'createdAt'>): MileageEntry {
    const amount = new Decimal(entry.distance).times(entry.rate).toNumber();
    
    const newEntry: MileageEntry = {
      ...entry,
      id: Date.now().toString(),
      amount,
      createdAt: new Date()
    };

    this.mileageEntries.push(newEntry);
    this.saveData();
    return newEntry;
  }

  updateMileageEntry(id: string, updates: Partial<MileageEntry>): MileageEntry | null {
    const index = this.mileageEntries.findIndex(entry => entry.id === id);
    if (index === -1) return null;

    const entry = { ...this.mileageEntries[index], ...updates };
    
    // Recalculate amount if distance or rate changed
    if (updates.distance !== undefined || updates.rate !== undefined) {
      entry.amount = new Decimal(entry.distance).times(entry.rate).toNumber();
    }

    this.mileageEntries[index] = entry;
    this.saveData();
    return entry;
  }

  deleteMileageEntry(id: string): boolean {
    const index = this.mileageEntries.findIndex(entry => entry.id === id);
    if (index === -1) return false;

    this.mileageEntries.splice(index, 1);
    this.saveData();
    return true;
  }

  // Business Expense Management
  getBusinessExpenses(): BusinessExpense[] {
    return this.businessExpenses.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  addBusinessExpense(expense: Omit<BusinessExpense, 'id' | 'createdAt'>): BusinessExpense {
    const newExpense: BusinessExpense = {
      ...expense,
      id: Date.now().toString(),
      createdAt: new Date()
    };

    this.businessExpenses.push(newExpense);
    this.saveData();
    return newExpense;
  }

  updateBusinessExpense(id: string, updates: Partial<BusinessExpense>): BusinessExpense | null {
    const index = this.businessExpenses.findIndex(expense => expense.id === id);
    if (index === -1) return null;

    this.businessExpenses[index] = { ...this.businessExpenses[index], ...updates };
    this.saveData();
    return this.businessExpenses[index];
  }

  deleteBusinessExpense(id: string): boolean {
    const index = this.businessExpenses.findIndex(expense => expense.id === id);
    if (index === -1) return false;

    this.businessExpenses.splice(index, 1);
    this.saveData();
    return true;
  }

  // Business Metrics and Reporting
  getBusinessMetrics(startDate?: Date, endDate?: Date): BusinessMetrics {
    const invoices = this.getInvoicesInRange(startDate, endDate);
    const expenses = this.getExpensesInRange(startDate, endDate);
    const mileage = this.getMileageInRange(startDate, endDate);

    const totalRevenue = invoices
      .filter(invoice => invoice.status === 'paid')
      .reduce((sum, invoice) => sum + invoice.total, 0);

    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0) +
                         mileage.reduce((sum, entry) => sum + entry.amount, 0);

    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const outstandingInvoices = invoices.filter(invoice => 
      invoice.status === 'sent' || invoice.status === 'overdue'
    ).length;

    const overdueInvoices = invoices.filter(invoice => 
      invoice.status === 'overdue' || 
      (invoice.status === 'sent' && invoice.dueDate < new Date())
    ).length;

    const paidInvoices = invoices.filter(invoice => invoice.status === 'paid' && invoice.paidAt);
    const averagePaymentTime = paidInvoices.length > 0 
      ? paidInvoices.reduce((sum, invoice) => {
          const daysDiff = Math.ceil((invoice.paidAt!.getTime() - invoice.issueDate.getTime()) / (1000 * 60 * 60 * 24));
          return sum + daysDiff;
        }, 0) / paidInvoices.length
      : 0;

    // Calculate top expense categories
    const categoryTotals = expenses.reduce((acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
      return acc;
    }, {} as Record<BusinessExpenseCategory, number>);

    const topExpenseCategories = Object.entries(categoryTotals)
      .map(([category, amount]) => ({
        category: category as BusinessExpenseCategory,
        amount,
        percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Calculate monthly trends (last 12 months)
    const monthlyTrends = this.calculateMonthlyTrends(invoices, expenses, mileage);

    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      profitMargin,
      outstandingInvoices,
      overdueInvoices,
      averagePaymentTime,
      topExpenseCategories,
      monthlyTrends
    };
  }

  private getInvoicesInRange(startDate?: Date, endDate?: Date): Invoice[] {
    if (!startDate && !endDate) return this.invoices;

    return this.invoices.filter(invoice => {
      const invoiceDate = invoice.issueDate;
      if (startDate && invoiceDate < startDate) return false;
      if (endDate && invoiceDate > endDate) return false;
      return true;
    });
  }

  private getExpensesInRange(startDate?: Date, endDate?: Date): BusinessExpense[] {
    if (!startDate && !endDate) return this.businessExpenses;

    return this.businessExpenses.filter(expense => {
      const expenseDate = expense.date;
      if (startDate && expenseDate < startDate) return false;
      if (endDate && expenseDate > endDate) return false;
      return true;
    });
  }

  private getMileageInRange(startDate?: Date, endDate?: Date): MileageEntry[] {
    if (!startDate && !endDate) return this.mileageEntries;

    return this.mileageEntries.filter(entry => {
      const entryDate = entry.date;
      if (startDate && entryDate < startDate) return false;
      if (endDate && entryDate > endDate) return false;
      return true;
    });
  }

  private calculateMonthlyTrends(invoices: Invoice[], expenses: BusinessExpense[], mileage: MileageEntry[]) {
    const trends: Array<{
      month: string;
      revenue: number;
      expenses: number;
      profit: number;
    }> = [];

    // Get last 12 months
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const monthInvoices = invoices.filter(invoice => 
        invoice.status === 'paid' && 
        invoice.paidAt &&
        invoice.paidAt >= monthStart && 
        invoice.paidAt <= monthEnd
      );

      const monthExpenses = expenses.filter(expense => 
        expense.date >= monthStart && expense.date <= monthEnd
      );

      const monthMileage = mileage.filter(entry => 
        entry.date >= monthStart && entry.date <= monthEnd
      );

      const revenue = monthInvoices.reduce((sum, invoice) => sum + invoice.total, 0);
      const expenseTotal = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0) +
                          monthMileage.reduce((sum, entry) => sum + entry.amount, 0);

      trends.push({
        month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        revenue,
        expenses: expenseTotal,
        profit: revenue - expenseTotal
      });
    }

    return trends;
  }

  // Utility methods
  generateInvoiceNumber(): string {
    const year = new Date().getFullYear();
    const count = this.invoices.length + 1;
    return `INV-${year}-${count.toString().padStart(3, '0')}`;
  }

  exportBusinessData(): {
    invoices: Invoice[];
    expenses: BusinessExpense[];
    mileage: MileageEntry[];
    metrics: BusinessMetrics;
  } {
    return {
      invoices: this.invoices,
      expenses: this.businessExpenses,
      mileage: this.mileageEntries,
      metrics: this.getBusinessMetrics()
    };
  }
}

export const businessService = new BusinessService();