import React, { useState, useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { useApp } from '../contexts/AppContext';
import { toDecimal } from '../utils/decimal';
import type { DecimalInstance } from '../types/decimal-types';
import { 
  PlusIcon, 
  FileTextIcon, 
  CalculatorIcon,
  FolderIcon,
  TagIcon,
  UploadIcon,
  DownloadIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  CalendarIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  DollarSignIcon,
  EditIcon,
  DeleteIcon,
  InfoIcon
} from './icons';

export interface TaxCategory {
  id: string;
  name: string;
  type: 'income' | 'deduction' | 'credit';
  isStandard: boolean;
  description: string;
  formReference?: string;
  transactionCategories: string[];
  estimatedAmount?: DecimalInstance;
  actualAmount?: DecimalInstance;
  documents: TaxDocument[];
}

export interface TaxDocument {
  id: string;
  name: string;
  type: 'w2' | '1099' | 'receipt' | 'statement' | 'other';
  categoryId: string;
  amount?: DecimalInstance;
  date: Date;
  notes?: string;
  filePath?: string;
  isRequired: boolean;
  isReceived: boolean;
}

export interface TaxProjection {
  taxYear: number;
  totalIncome: DecimalInstance;
  totalDeductions: DecimalInstance;
  totalCredits: DecimalInstance;
  estimatedTax: DecimalInstance;
  effectiveRate: DecimalInstance;
  marginalRate: DecimalInstance;
  refundOrOwed: DecimalInstance;
}

export interface TaxSummaryReport {
  taxYear: number;
  totalIncome: DecimalInstance;
  totalDeductions: DecimalInstance;
  totalCredits: DecimalInstance;
  estimatedTax: DecimalInstance;
  effectiveRate: DecimalInstance;
  marginalRate: DecimalInstance;
  standardDeduction: DecimalInstance;
  itemizedDeductions: DecimalInstance;
  taxableIncome: DecimalInstance;
  categoryBreakdown: {
    income: Array<{ name: string; amount: DecimalInstance; }>;
    deductions: Array<{ name: string; amount: DecimalInstance; }>;
    credits: Array<{ name: string; amount: DecimalInstance; }>;
  };
  quarterlyBreakdown: Array<{
    quarter: number;
    income: DecimalInstance;
    deductions: DecimalInstance;
    estimatedTax: DecimalInstance;
  }>;
}

export interface TaxDeduction {
  id: string;
  name: string;
  categoryId: string;
  amount: DecimalInstance;
  date: Date;
  description: string;
  receiptPath?: string;
  isRecurring: boolean;
  transactionId?: string;
  taxYear: number;
}

const STANDARD_TAX_CATEGORIES: Omit<TaxCategory, 'id' | 'transactionCategories' | 'documents'>[] = [
  {
    name: 'W-2 Wages',
    type: 'income',
    isStandard: true,
    description: 'Employment income from W-2 forms',
    formReference: 'Form 1040, Line 1',
    estimatedAmount: toDecimal(0),
    actualAmount: toDecimal(0)
  },
  {
    name: '1099 Income',
    type: 'income',
    isStandard: true,
    description: 'Independent contractor and freelance income',
    formReference: 'Form 1040, Line 8',
    estimatedAmount: toDecimal(0),
    actualAmount: toDecimal(0)
  },
  {
    name: 'Investment Income',
    type: 'income',
    isStandard: true,
    description: 'Dividends, interest, and capital gains',
    formReference: 'Schedule B, Schedule D',
    estimatedAmount: toDecimal(0),
    actualAmount: toDecimal(0)
  },
  {
    name: 'Business Expenses',
    type: 'deduction',
    isStandard: true,
    description: 'Legitimate business expenses',
    formReference: 'Schedule C',
    estimatedAmount: toDecimal(0),
    actualAmount: toDecimal(0)
  },
  {
    name: 'Home Office',
    type: 'deduction',
    isStandard: true,
    description: 'Home office expenses',
    formReference: 'Form 8829',
    estimatedAmount: toDecimal(0),
    actualAmount: toDecimal(0)
  },
  {
    name: 'Charitable Donations',
    type: 'deduction',
    isStandard: true,
    description: 'Charitable contributions',
    formReference: 'Schedule A',
    estimatedAmount: toDecimal(0),
    actualAmount: toDecimal(0)
  },
  {
    name: 'State and Local Taxes',
    type: 'deduction',
    isStandard: true,
    description: 'State and local tax deductions (SALT)',
    formReference: 'Schedule A',
    estimatedAmount: toDecimal(0),
    actualAmount: toDecimal(0)
  },
  {
    name: 'Medical Expenses',
    type: 'deduction',
    isStandard: true,
    description: 'Medical and dental expenses',
    formReference: 'Schedule A',
    estimatedAmount: toDecimal(0),
    actualAmount: toDecimal(0)
  },
  {
    name: 'Child Tax Credit',
    type: 'credit',
    isStandard: true,
    description: 'Child tax credit',
    formReference: 'Form 1040, Line 19',
    estimatedAmount: toDecimal(0),
    actualAmount: toDecimal(0)
  },
  {
    name: 'Earned Income Credit',
    type: 'credit',
    isStandard: true,
    description: 'Earned income tax credit',
    formReference: 'Form 1040, Line 27',
    estimatedAmount: toDecimal(0),
    actualAmount: toDecimal(0)
  }
];

export default function TaxPlanning() {
  const { transactions, categories } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const [taxCategories, setTaxCategories] = useLocalStorage<TaxCategory[]>('tax-categories', []);
  const [taxDocuments, setTaxDocuments] = useLocalStorage<TaxDocument[]>('tax-documents', []);
  const [taxDeductions, setTaxDeductions] = useLocalStorage<TaxDeduction[]>('tax-deductions', []);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<'categories' | 'documents' | 'projection' | 'reports' | 'deductions'>('categories');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddDocument, setShowAddDocument] = useState(false);
  const [showAddDeduction, setShowAddDeduction] = useState(false);
  
  const [newCategory, setNewCategory] = useState({
    name: '',
    type: 'deduction' as TaxCategory['type'],
    description: '',
    formReference: '',
    estimatedAmount: ''
  });

  const [newDocument, setNewDocument] = useState({
    name: '',
    type: 'receipt' as TaxDocument['type'],
    categoryId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [newDeduction, setNewDeduction] = useState({
    name: '',
    categoryId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    isRecurring: false
  });

  // Initialize with standard categories if empty
  React.useEffect(() => {
    if (taxCategories.length === 0) {
      const standardCategories = STANDARD_TAX_CATEGORIES.map(cat => ({
        ...cat,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        transactionCategories: [],
        documents: []
      }));
      setTaxCategories(standardCategories);
    }
  }, [taxCategories.length, setTaxCategories]);

  const calculateTaxProjection = useMemo((): TaxProjection => {
    const currentYear = selectedYear;
    const yearTransactions = transactions.filter(t => 
      new Date(t.date).getFullYear() === currentYear
    );

    // Calculate totals from categories
    const totalIncome = taxCategories
      .filter(cat => cat.type === 'income')
      .reduce((sum, cat) => {
        const categoryAmount = cat.actualAmount || cat.estimatedAmount || toDecimal(0);
        return sum.plus(categoryAmount);
      }, toDecimal(0));

    const totalDeductions = taxCategories
      .filter(cat => cat.type === 'deduction')
      .reduce((sum, cat) => {
        const categoryAmount = cat.actualAmount || cat.estimatedAmount || toDecimal(0);
        return sum.plus(categoryAmount);
      }, toDecimal(0));

    const totalCredits = taxCategories
      .filter(cat => cat.type === 'credit')
      .reduce((sum, cat) => {
        const categoryAmount = cat.actualAmount || cat.estimatedAmount || toDecimal(0);
        return sum.plus(categoryAmount);
      }, toDecimal(0));

    // Simplified tax calculation (for illustration)
    const standardDeduction = toDecimal(12950); // 2022 standard deduction for single filer
    const effectiveDeduction = totalDeductions.greaterThan(standardDeduction) ? totalDeductions : standardDeduction;
    const taxableIncome = totalIncome.minus(effectiveDeduction);
    
    // Simplified tax brackets (2022)
    let estimatedTax = toDecimal(0);
    let remainingIncome = taxableIncome;
    
    const brackets = [
      { min: 0, max: 10275, rate: 0.10 },
      { min: 10275, max: 41775, rate: 0.12 },
      { min: 41775, max: 89450, rate: 0.22 },
      { min: 89450, max: 190750, rate: 0.24 },
      { min: 190750, max: 364200, rate: 0.32 },
      { min: 364200, max: 462550, rate: 0.35 },
      { min: 462550, max: Infinity, rate: 0.37 }
    ];

    let marginalRate = toDecimal(0);
    
    for (const bracket of brackets) {
      if (remainingIncome.greaterThan(0)) {
        const taxableAtBracket = remainingIncome.greaterThan(bracket.max - bracket.min) 
          ? toDecimal(bracket.max - bracket.min)
          : remainingIncome;
        
        estimatedTax = estimatedTax.plus(taxableAtBracket.times(bracket.rate));
        remainingIncome = remainingIncome.minus(taxableAtBracket);
        marginalRate = toDecimal(bracket.rate);
      }
    }

    estimatedTax = estimatedTax.minus(totalCredits);
    const effectiveRate = totalIncome.greaterThan(0) ? estimatedTax.dividedBy(totalIncome) : toDecimal(0);

    return {
      taxYear: currentYear,
      totalIncome,
      totalDeductions,
      totalCredits,
      estimatedTax: estimatedTax.greaterThan(0) ? estimatedTax : toDecimal(0),
      effectiveRate,
      marginalRate,
      refundOrOwed: toDecimal(0) // Would need withholding info
    };
  }, [taxCategories, selectedYear, transactions]);

  const handleAddCategory = () => {
    if (!newCategory.name || !newCategory.type) return;
    
    const category: TaxCategory = {
      id: Date.now().toString(),
      name: newCategory.name,
      type: newCategory.type,
      isStandard: false,
      description: newCategory.description,
      formReference: newCategory.formReference,
      transactionCategories: [],
      estimatedAmount: newCategory.estimatedAmount ? toDecimal(parseFloat(newCategory.estimatedAmount)) : undefined,
      documents: []
    };
    
    setTaxCategories([...taxCategories, category]);
    setNewCategory({
      name: '',
      type: 'deduction',
      description: '',
      formReference: '',
      estimatedAmount: ''
    });
    setShowAddCategory(false);
  };

  const handleAddDocument = () => {
    if (!newDocument.name || !newDocument.categoryId) return;
    
    const document: TaxDocument = {
      id: Date.now().toString(),
      name: newDocument.name,
      type: newDocument.type,
      categoryId: newDocument.categoryId,
      amount: newDocument.amount ? toDecimal(parseFloat(newDocument.amount)) : undefined,
      date: new Date(newDocument.date),
      notes: newDocument.notes,
      isRequired: false,
      isReceived: true
    };
    
    setTaxDocuments([...taxDocuments, document]);
    setNewDocument({
      name: '',
      type: 'receipt',
      categoryId: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setShowAddDocument(false);
  };

  const handleAddDeduction = () => {
    if (!newDeduction.name || !newDeduction.categoryId || !newDeduction.amount) return;
    
    const deduction: TaxDeduction = {
      id: Date.now().toString(),
      name: newDeduction.name,
      categoryId: newDeduction.categoryId,
      amount: toDecimal(parseFloat(newDeduction.amount)),
      date: new Date(newDeduction.date),
      description: newDeduction.description,
      isRecurring: newDeduction.isRecurring,
      taxYear: new Date(newDeduction.date).getFullYear()
    };
    
    setTaxDeductions([...taxDeductions, deduction]);
    setNewDeduction({
      name: '',
      categoryId: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      description: '',
      isRecurring: false
    });
    setShowAddDeduction(false);
  };

  const generateTaxSummaryReport = (year: number): TaxSummaryReport => {
    const yearDeductions = taxDeductions.filter(d => d.taxYear === year);
    const yearDocuments = taxDocuments.filter(d => new Date(d.date).getFullYear() === year);
    
    // Calculate category breakdown
    const incomeCategories = taxCategories.filter(c => c.type === 'income').map(cat => ({
      name: cat.name,
      amount: cat.actualAmount || cat.estimatedAmount || toDecimal(0)
    }));
    
    const deductionCategories = taxCategories.filter(c => c.type === 'deduction').map(cat => {
      const categoryDeductions = yearDeductions.filter(d => d.categoryId === cat.id);
      const deductionTotal = categoryDeductions.reduce((sum, d) => sum.plus(d.amount), toDecimal(0));
      const estimatedAmount = cat.actualAmount || cat.estimatedAmount || toDecimal(0);
      
      return {
        name: cat.name,
        amount: deductionTotal.plus(estimatedAmount)
      };
    });
    
    const creditCategories = taxCategories.filter(c => c.type === 'credit').map(cat => ({
      name: cat.name,
      amount: cat.actualAmount || cat.estimatedAmount || toDecimal(0)
    }));
    
    // Calculate quarterly breakdown
    const quarters = [1, 2, 3, 4];
    const quarterlyBreakdown = quarters.map(quarter => {
      const quarterStart = new Date(year, (quarter - 1) * 3, 1);
      const quarterEnd = new Date(year, quarter * 3, 0);
      
      const quarterDeductions = yearDeductions.filter(d => 
        d.date >= quarterStart && d.date <= quarterEnd
      );
      
      const quarterIncome = incomeCategories.reduce((sum, cat) => 
        sum.plus(cat.amount.dividedBy(4)), toDecimal(0)
      );
      
      const quarterDeductionTotal = quarterDeductions.reduce((sum, d) => 
        sum.plus(d.amount), toDecimal(0)
      );
      
      return {
        quarter,
        income: quarterIncome,
        deductions: quarterDeductionTotal,
        estimatedTax: quarterIncome.times(0.25) // Rough estimate
      };
    });
    
    const totalIncome = incomeCategories.reduce((sum, cat) => sum.plus(cat.amount), toDecimal(0));
    const totalDeductions = deductionCategories.reduce((sum, cat) => sum.plus(cat.amount), toDecimal(0));
    const totalCredits = creditCategories.reduce((sum, cat) => sum.plus(cat.amount), toDecimal(0));
    
    const standardDeduction = toDecimal(12950);
    const itemizedDeductions = totalDeductions;
    const effectiveDeduction = itemizedDeductions.greaterThan(standardDeduction) ? itemizedDeductions : standardDeduction;
    const taxableIncome = totalIncome.minus(effectiveDeduction);
    
    // Use same tax calculation as projection
    const projection = calculateTaxProjection;
    
    return {
      taxYear: year,
      totalIncome,
      totalDeductions,
      totalCredits,
      estimatedTax: projection.estimatedTax,
      effectiveRate: projection.effectiveRate,
      marginalRate: projection.marginalRate,
      standardDeduction,
      itemizedDeductions,
      taxableIncome,
      categoryBreakdown: {
        income: incomeCategories,
        deductions: deductionCategories,
        credits: creditCategories
      },
      quarterlyBreakdown
    };
  };

  const updateCategoryAmount = (categoryId: string, field: 'estimatedAmount' | 'actualAmount', value: string) => {
    setTaxCategories(taxCategories.map(cat => 
      cat.id === categoryId 
        ? { ...cat, [field]: value ? toDecimal(parseFloat(value)) : undefined }
        : cat
    ));
  };

  const generateTaxReport = () => {
    const report = {
      taxYear: selectedYear,
      projection: calculateTaxProjection,
      categories: taxCategories,
      documents: taxDocuments.filter(doc => 
        new Date(doc.date).getFullYear() === selectedYear
      )
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tax-report-${selectedYear}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const requiredDocuments = taxDocuments.filter(doc => doc.isRequired && !doc.isReceived);
  const completedCategories = taxCategories.filter(cat => cat.actualAmount || cat.estimatedAmount);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Tax Planning</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Organize tax documents and estimate your tax liability
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          
          <button
            onClick={generateTaxReport}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <DownloadIcon size={16} />
            Export Report
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Income</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(calculateTaxProjection.totalIncome)}
              </p>
            </div>
            <TrendingUpIcon className="text-green-500" size={24} />
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Deductions</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(calculateTaxProjection.totalDeductions)}
              </p>
            </div>
            <TrendingDownIcon className="text-blue-500" size={24} />
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Estimated Tax</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(calculateTaxProjection.estimatedTax)}
              </p>
            </div>
            <CalculatorIcon className="text-red-500" size={24} />
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Effective Rate</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {calculateTaxProjection.effectiveRate.times(100).toFixed(1)}%
              </p>
            </div>
            <DollarSignIcon className="text-gray-500" size={24} />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
        {[
          { id: 'categories', label: 'Categories', icon: TagIcon, count: completedCategories.length },
          { id: 'documents', label: 'Documents', icon: FileTextIcon, count: requiredDocuments.length },
          { id: 'deductions', label: 'Deductions', icon: DollarSignIcon, count: taxDeductions.filter(d => d.taxYear === selectedYear).length },
          { id: 'projection', label: 'Projection', icon: CalculatorIcon },
          { id: 'reports', label: 'Reports', icon: BarChart3Icon }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.id
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'categories' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tax Categories</h3>
            <button
              onClick={() => setShowAddCategory(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
            >
              <PlusIcon size={16} />
              Add Category
            </button>
          </div>

          {/* Income Categories */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Income</h4>
            <div className="space-y-4">
              {taxCategories.filter(cat => cat.type === 'income').map(category => (
                <div key={category.id} className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-green-900 dark:text-green-100">{category.name}</h5>
                    <span className="text-xs text-green-700 dark:text-green-300">{category.formReference}</span>
                  </div>
                  <p className="text-sm text-green-800 dark:text-green-200 mb-3">{category.description}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-green-700 dark:text-green-300 mb-1">
                        Estimated Amount
                      </label>
                      <input
                        type="number"
                        value={category.estimatedAmount?.toString() || ''}
                        onChange={(e) => updateCategoryAmount(category.id, 'estimatedAmount', e.target.value)}
                        className="w-full px-3 py-2 border border-green-300 dark:border-green-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-green-700 dark:text-green-300 mb-1">
                        Actual Amount
                      </label>
                      <input
                        type="number"
                        value={category.actualAmount?.toString() || ''}
                        onChange={(e) => updateCategoryAmount(category.id, 'actualAmount', e.target.value)}
                        className="w-full px-3 py-2 border border-green-300 dark:border-green-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Deduction Categories */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Deductions</h4>
            <div className="space-y-4">
              {taxCategories.filter(cat => cat.type === 'deduction').map(category => (
                <div key={category.id} className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-blue-900 dark:text-blue-100">{category.name}</h5>
                    <span className="text-xs text-blue-700 dark:text-blue-300">{category.formReference}</span>
                  </div>
                  <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">{category.description}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                        Estimated Amount
                      </label>
                      <input
                        type="number"
                        value={category.estimatedAmount?.toString() || ''}
                        onChange={(e) => updateCategoryAmount(category.id, 'estimatedAmount', e.target.value)}
                        className="w-full px-3 py-2 border border-blue-300 dark:border-blue-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                        Actual Amount
                      </label>
                      <input
                        type="number"
                        value={category.actualAmount?.toString() || ''}
                        onChange={(e) => updateCategoryAmount(category.id, 'actualAmount', e.target.value)}
                        className="w-full px-3 py-2 border border-blue-300 dark:border-blue-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Credit Categories */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Credits</h4>
            <div className="space-y-4">
              {taxCategories.filter(cat => cat.type === 'credit').map(category => (
                <div key={category.id} className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-purple-900 dark:text-purple-100">{category.name}</h5>
                    <span className="text-xs text-purple-700 dark:text-purple-300">{category.formReference}</span>
                  </div>
                  <p className="text-sm text-purple-800 dark:text-purple-200 mb-3">{category.description}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">
                        Estimated Amount
                      </label>
                      <input
                        type="number"
                        value={category.estimatedAmount?.toString() || ''}
                        onChange={(e) => updateCategoryAmount(category.id, 'estimatedAmount', e.target.value)}
                        className="w-full px-3 py-2 border border-purple-300 dark:border-purple-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">
                        Actual Amount
                      </label>
                      <input
                        type="number"
                        value={category.actualAmount?.toString() || ''}
                        onChange={(e) => updateCategoryAmount(category.id, 'actualAmount', e.target.value)}
                        className="w-full px-3 py-2 border border-purple-300 dark:border-purple-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tax Documents</h3>
            <button
              onClick={() => setShowAddDocument(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
            >
              <PlusIcon size={16} />
              Add Document
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {taxDocuments.filter(doc => 
              new Date(doc.date).getFullYear() === selectedYear
            ).map(document => {
              const category = taxCategories.find(cat => cat.id === document.categoryId);
              return (
                <div
                  key={document.id}
                  className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <FileTextIcon className="text-gray-600 dark:text-gray-400" size={20} />
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {document.name}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                          {document.type.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {document.isReceived ? (
                        <CheckCircleIcon className="text-green-500" size={16} />
                      ) : (
                        <AlertCircleIcon className="text-orange-500" size={16} />
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Category:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {category?.name || 'Unknown'}
                      </span>
                    </div>
                    
                    {document.amount && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatCurrency(document.amount)}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Date:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {document.date.toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {document.notes && (
                    <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <p className="text-sm text-gray-700 dark:text-gray-300">{document.notes}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {taxDocuments.filter(doc => 
            new Date(doc.date).getFullYear() === selectedYear
          ).length === 0 && (
            <div className="text-center py-12">
              <FolderIcon className="mx-auto text-gray-400 mb-4" size={48} />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No documents for {selectedYear}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Add tax documents to keep track of your records
              </p>
              <button
                onClick={() => setShowAddDocument(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
              >
                <PlusIcon size={16} />
                Add First Document
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'projection' && (
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            Tax Projection for {selectedYear}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-4">Income Summary</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total Income:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(calculateTaxProjection.totalIncome)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total Deductions:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(calculateTaxProjection.totalDeductions)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Taxable Income:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(calculateTaxProjection.totalIncome.minus(calculateTaxProjection.totalDeductions))}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-4">Tax Calculation</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Estimated Tax:</span>
                    <span className="font-medium text-red-600 dark:text-red-400">
                      {formatCurrency(calculateTaxProjection.estimatedTax)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Tax Credits:</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {formatCurrency(calculateTaxProjection.totalCredits)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-3">
                    <span className="text-gray-600 dark:text-gray-400">Final Tax Liability:</span>
                    <span className="font-bold text-red-600 dark:text-red-400">
                      {formatCurrency(calculateTaxProjection.estimatedTax.minus(calculateTaxProjection.totalCredits))}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-4">Tax Rates</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Effective Tax Rate:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {calculateTaxProjection.effectiveRate.times(100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Marginal Tax Rate:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {calculateTaxProjection.marginalRate.times(100).toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <InfoIcon className="text-blue-600 dark:text-blue-400" size={16} />
                  <h5 className="font-medium text-blue-900 dark:text-blue-100">Tax Planning Tips</h5>
                </div>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <li>• Consider maximizing retirement contributions</li>
                  <li>• Review available tax credits</li>
                  <li>• Track deductible expenses throughout the year</li>
                  <li>• Consider tax-loss harvesting for investments</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'deductions' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Tax Deductions for {selectedYear}
            </h3>
            <button
              onClick={() => setShowAddDeduction(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
            >
              <PlusIcon size={16} />
              Add Deduction
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {taxDeductions.filter(d => d.taxYear === selectedYear).map(deduction => {
              const category = taxCategories.find(c => c.id === deduction.categoryId);
              return (
                <div key={deduction.id} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                        {deduction.name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {category?.name || 'Unknown Category'}
                      </p>
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(deduction.amount)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {deduction.date.toLocaleDateString()}
                      </p>
                      {deduction.isRecurring && (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mt-1">
                          <RepeatIcon size={12} />
                          Recurring
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {deduction.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {deduction.description}
                    </p>
                  )}
                  
                  <div className="flex justify-end gap-2">
                    <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                      <EditIcon size={16} />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-red-500">
                      <DeleteIcon size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
            
            {taxDeductions.filter(d => d.taxYear === selectedYear).length === 0 && (
              <div className="col-span-full text-center py-12">
                <DollarSignIcon className="mx-auto text-gray-400 mb-4" size={48} />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No deductions recorded for {selectedYear}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Add your tax deductions to track and organize them for tax season
                </p>
                <button
                  onClick={() => setShowAddDeduction(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
                >
                  <PlusIcon size={16} />
                  Add Your First Deduction
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="text-center py-12">
          <CalendarIcon className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Detailed Reports Coming Soon
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Advanced tax reports and analysis will be available in a future update
          </p>
          <button
            onClick={generateTaxReport}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
          >
            <DownloadIcon size={16} />
            Export Current Data
          </button>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add Tax Category</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Category Name
                </label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., Home Office Equipment"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Type
                </label>
                <select
                  value={newCategory.type}
                  onChange={(e) => setNewCategory({...newCategory, type: e.target.value as TaxCategory['type']})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="income">Income</option>
                  <option value="deduction">Deduction</option>
                  <option value="credit">Credit</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={newCategory.description}
                  onChange={(e) => setNewCategory({...newCategory, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={3}
                  placeholder="Brief description of this category..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Form Reference (Optional)
                </label>
                <input
                  type="text"
                  value={newCategory.formReference}
                  onChange={(e) => setNewCategory({...newCategory, formReference: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., Schedule C, Line 13"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Estimated Amount (Optional)
                </label>
                <input
                  type="number"
                  value={newCategory.estimatedAmount}
                  onChange={(e) => setNewCategory({...newCategory, estimatedAmount: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddCategory(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCategory}
                className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
              >
                Add Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Document Modal */}
      {showAddDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add Tax Document</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Document Name
                </label>
                <input
                  type="text"
                  value={newDocument.name}
                  onChange={(e) => setNewDocument({...newDocument, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., W-2 from Company ABC"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Document Type
                </label>
                <select
                  value={newDocument.type}
                  onChange={(e) => setNewDocument({...newDocument, type: e.target.value as TaxDocument['type']})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="w2">W-2</option>
                  <option value="1099">1099</option>
                  <option value="receipt">Receipt</option>
                  <option value="statement">Statement</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tax Category
                </label>
                <select
                  value={newDocument.categoryId}
                  onChange={(e) => setNewDocument({...newDocument, categoryId: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select category...</option>
                  {taxCategories.map(category => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Amount (Optional)
                  </label>
                  <input
                    type="number"
                    value={newDocument.amount}
                    onChange={(e) => setNewDocument({...newDocument, amount: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    value={newDocument.date}
                    onChange={(e) => setNewDocument({...newDocument, date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={newDocument.notes}
                  onChange={(e) => setNewDocument({...newDocument, notes: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={2}
                  placeholder="Additional notes..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddDocument(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddDocument}
                className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
              >
                Add Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Deduction Modal */}
      {showAddDeduction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add Tax Deduction</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Deduction Name
                </label>
                <input
                  type="text"
                  value={newDeduction.name}
                  onChange={(e) => setNewDeduction({...newDeduction, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., Office Supplies"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tax Category
                </label>
                <select
                  value={newDeduction.categoryId}
                  onChange={(e) => setNewDeduction({...newDeduction, categoryId: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select category...</option>
                  {taxCategories.filter(c => c.type === 'deduction').map(category => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Amount
                  </label>
                  <input
                    type="number"
                    value={newDeduction.amount}
                    onChange={(e) => setNewDeduction({...newDeduction, amount: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    value={newDeduction.date}
                    onChange={(e) => setNewDeduction({...newDeduction, date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={newDeduction.description}
                  onChange={(e) => setNewDeduction({...newDeduction, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={2}
                  placeholder="Description of the deduction..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isRecurring"
                  checked={newDeduction.isRecurring}
                  onChange={(e) => setNewDeduction({...newDeduction, isRecurring: e.target.checked})}
                  className="rounded"
                />
                <label htmlFor="isRecurring" className="text-sm text-gray-700 dark:text-gray-300">
                  Recurring deduction
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddDeduction(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddDeduction}
                className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
              >
                Add Deduction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}