export interface ZeroBudgetItem {
  id: string;
  category: string;
  subcategory?: string;
  description: string;
  amount: number;
  frequency: 'once' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  priority: 'essential' | 'important' | 'nice-to-have';
  startDate?: Date;
  endDate?: Date;
  notes?: string;
  isRecurring: boolean;
  isApproved: boolean;
}

export interface ZeroBudgetPeriod {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  totalIncome: number;
  items: ZeroBudgetItem[];
  status: 'draft' | 'active' | 'completed';
  createdAt: Date;
}

export interface SavedZeroBudgetPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  totalIncome: number;
  items: Array<{
    id: string;
    category: string;
    subcategory?: string;
    description: string;
    amount: number;
    frequency: string;
    priority: string;
    startDate?: string;
    endDate?: string;
    notes?: string;
    isRecurring: boolean;
    isApproved: boolean;
  }>;
  status: string;
  createdAt: string;
}