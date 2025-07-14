import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useCurrency } from '../hooks/useCurrency';
import { useReconciliation } from '../hooks/useReconciliation';
import TestDataWarningModal from '../components/TestDataWarningModal';
import OnboardingModal from '../components/OnboardingModal';
import DashboardModal from '../components/DashboardModal';
import IncomeExpenditureReport from '../components/IncomeExpenditureReport';
import ErrorBoundary from '../components/ErrorBoundary';

export default function Dashboard() {
  const { accounts, transactions, categories, hasTestData, clearAllData } = useApp();
  const { firstName, setFirstName, setCurrency } = usePreferences();
  const { formatCurrency, convertAndSum, displayCurrency } = useCurrency();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [showTestDataWarning, setShowTestDataWarning] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'networth-chart' | 'account-distribution' | 'income-expenditure' | 'reconciliation' | null;
    title: string;
    data?: any;
  }>({
    isOpen: false,
    type: null,
    title: ''
  });
  const [convertedTotals, setConvertedTotals] = useState({
    assets: 0,
    liabilities: 0,
    netWorth: 0
  });
  
  // Income/Expenditure report settings
  const [incomeExpReportSettings, setIncomeExpReportSettings] = useState({
    categoryLevel: 'type' as 'type' | 'sub' | 'detail',
    excludedCategories: [] as string[],
    timePeriod: '12months' as '1month' | '12months' | '24months' | 'custom',
    customStartDate: '',
    customEndDate: '',
    showSettings: false,
    showCategoryModal: false
  });
  
  // Calculate totals with currency conversion
  useEffect(() => {
    let cancelled = false;
    
    const calculateTotals = async () => {
      setIsLoading(true);
      
      try {
        const assetAccounts = accounts.filter(acc => acc.balance > 0);
        const liabilityAccounts = accounts.filter(acc => acc.balance < 0);
        
        const [totalAssets, totalLiabilities] = await Promise.all([
          convertAndSum(assetAccounts.map(acc => ({ amount: acc.balance, currency: acc.currency }))),
          convertAndSum(liabilityAccounts.map(acc => ({ amount: Math.abs(acc.balance), currency: acc.currency })))
        ]);
        
        if (!cancelled) {
          setConvertedTotals({
            assets: totalAssets,
            liabilities: totalLiabilities,
            netWorth: totalAssets - totalLiabilities
          });
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error calculating totals:', error);
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    
    calculateTotals();
    
    return () => {
      cancelled = true;
    };
  }, [accounts, displayCurrency, convertAndSum]);
  
  const { assets: totalAssets, liabilities: totalLiabilities, netWorth } = convertedTotals;
  
  // Check for test data on component mount
  useEffect(() => {
    if (hasTestData) {
      const warningDismissed = localStorage.getItem('testDataWarningDismissed');
      if (warningDismissed !== 'true') {
        setShowTestDataWarning(true);
      }
    }
  }, [hasTestData, accounts.length]);

  // Check if onboarding should be shown
  useEffect(() => {
    const onboardingCompleted = localStorage.getItem('onboardingCompleted');
    if (!onboardingCompleted && !firstName && !showTestDataWarning) {
      setShowOnboarding(true);
    }
  }, [firstName, showTestDataWarning]);

  // Use reconciliation hook
  const { reconciliationDetails } = useReconciliation(accounts, transactions);

  // Generate net worth data for chart
  const netWorthData = useMemo(() => {
    const last12Months = [];
    const currentDate = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const month = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      // Calculate net worth for this month
      // For now, using current net worth as placeholder
      // In a real app, you'd calculate historical values
      last12Months.push({
        month,
        netWorth: netWorth * (1 - i * 0.02) // Simulated growth
      });
    }
    
    return last12Months;
  }, [netWorth]);

  // Generate pie chart data for account distribution
  const pieData = useMemo(() => {
    return accounts
      .filter(acc => acc.balance > 0)
      .map(acc => ({
        id: acc.id,
        name: acc.name,
        value: acc.balance
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Top 5 accounts
  }, [accounts]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  const chartStyles = useMemo(() => ({
    tooltip: {
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      border: '1px solid #E5E7EB',
      borderRadius: '8px'
    },
    pieTooltip: {
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      border: '1px solid #ccc',
      borderRadius: '8px'
    }
  }), []);

  // Generate income and expenditure data based on settings
  const incomeExpenditureData = useMemo(() => {
    try {
      // Generate months based on time period setting
      const months: Array<{
        key: string;
        label: string;
        startDate: Date;
        endDate: Date;
      }> = [];
      const currentDate = new Date();
      
      let startDate: Date;
      let endDate: Date;
      
      if (incomeExpReportSettings.timePeriod === 'custom' && incomeExpReportSettings.customStartDate && incomeExpReportSettings.customEndDate) {
        startDate = new Date(incomeExpReportSettings.customStartDate);
        endDate = new Date(incomeExpReportSettings.customEndDate);
      } else {
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0); // End of current month
        if (incomeExpReportSettings.timePeriod === '1month') {
          startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        } else if (incomeExpReportSettings.timePeriod === '24months') {
          startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 23, 1);
        } else {
          // Default to 12 months
          startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 11, 1);
        }
      }
      
      // Generate months between start and end dates
      const tempDate = new Date(startDate);
      while (tempDate <= endDate) {
        months.push({
          key: `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}`,
          label: tempDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          startDate: new Date(tempDate.getFullYear(), tempDate.getMonth(), 1),
          endDate: new Date(tempDate.getFullYear(), tempDate.getMonth() + 1, 0)
        });
        tempDate.setMonth(tempDate.getMonth() + 1);
      }

      // Helper function to check if a category or any of its ancestors is excluded
      const isCategoryExcluded = (categoryId: string): boolean => {
        let currentCat = categories.find(c => c.id === categoryId);
        while (currentCat) {
          if (incomeExpReportSettings.excludedCategories.includes(currentCat.id)) {
            return true;
          }
          currentCat = categories.find(c => c.id === currentCat?.parentId);
        }
        return false;
      };

      // Helper function to check if a category is a descendant of another
      const isDescendant = (childId: string, ancestorId: string): boolean => {
        if (!childId || !ancestorId) return false;
        if (childId === ancestorId) return true;
        const child = categories.find(c => c.id === childId);
        if (!child || !child.parentId) return false;
        return isDescendant(child.parentId, ancestorId);
      };

      // Calculate data for each category and month
      const calculateCategoryData = (category: any) => {
        if (!category || !category.id) {
          return {
            category: category || { id: 'unknown', name: 'Unknown' },
            monthlyData: [],
            totalIncome: 0,
            totalExpenditure: 0,
            totalNet: 0
          };
        }
        
        const monthlyData = months.map(month => {
          const monthTransactions = transactions.filter(transaction => {
            const transactionDate = new Date(transaction.date);
            const matchesCategory = isDescendant(transaction.category, category.id);
            return matchesCategory && 
              transactionDate >= month.startDate && 
              transactionDate <= month.endDate &&
              !isCategoryExcluded(transaction.category);
          });

          const income = monthTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);
          
          const expenditure = monthTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

          return {
            month: month.key,
            monthLabel: month.label,
            income,
            expenditure,
            net: income - expenditure
          };
        });

        const totalIncome = monthlyData.reduce((sum, m) => sum + m.income, 0);
        const totalExpenditure = monthlyData.reduce((sum, m) => sum + m.expenditure, 0);

        return {
          category,
          monthlyData,
          totalIncome,
          totalExpenditure,
          totalNet: totalIncome - totalExpenditure
        };
      };

      // Build report data based on category level
      let reportData: any[] = [];
      const incomeType = categories.find(c => c.id === 'type-income' || (c.level === 'type' && c.name === 'Income'));
      const expenseType = categories.find(c => c.id === 'type-expense' || (c.level === 'type' && c.name === 'Expense'));
      
      // Early return if essential categories are missing
      if (!incomeType || !expenseType) {
        console.error('Missing essential type categories. Income:', incomeType, 'Expense:', expenseType);
        return {
          months,
          categories: [],
          monthlyTotals: [],
          grandTotalIncome: 0,
          grandTotalExpenditure: 0
        };
      }
      
      if (incomeExpReportSettings.categoryLevel === 'type') {
        // Type level - just show Income and Expense
        if (incomeType && !incomeExpReportSettings.excludedCategories.includes(incomeType.id)) {
          const data = calculateCategoryData(incomeType);
          if (data.totalIncome > 0 || data.totalExpenditure > 0) {
            reportData.push(data);
          }
        }
        if (expenseType && !incomeExpReportSettings.excludedCategories.includes(expenseType.id)) {
          const data = calculateCategoryData(expenseType);
          if (data.totalIncome > 0 || data.totalExpenditure > 0) {
            reportData.push(data);
          }
        }
      } else if (incomeExpReportSettings.categoryLevel === 'sub') {
        // Sub-category level - show Income/Expense headers with their subcategories
        if (incomeType && !incomeExpReportSettings.excludedCategories.includes(incomeType.id)) {
          const incomeSubs = categories.filter(c => 
            c.parentId === incomeType.id && 
            c.level === 'sub' &&
            !c.name.toLowerCase().includes('transfer') &&
            !incomeExpReportSettings.excludedCategories.includes(c.id)
          );

          if (incomeSubs.length > 0) {
            const incomeSubData = incomeSubs.map(sub => calculateCategoryData(sub))
              .filter(data => data.totalIncome > 0 || data.totalExpenditure > 0);

            if (incomeSubData.length > 0) {
              // Calculate monthly subtotals for income
              const incomeMonthlySubtotals = months.map(month => {
                const monthTotal = incomeSubData.reduce((sum, item) => {
                  if (!item || !item.monthlyData || !Array.isArray(item.monthlyData)) {
                    console.warn('Invalid item in incomeSubData:', item);
                    return sum;
                  }
                  const monthData = item.monthlyData.find((m: any) => m.month === month.key);
                  return sum + (monthData ? monthData.net : 0);
                }, 0);
                return {
                  month: month.key,
                  monthLabel: month.label,
                  income: monthTotal > 0 ? monthTotal : 0,
                  expenditure: monthTotal < 0 ? Math.abs(monthTotal) : 0,
                  net: monthTotal
                };
              });
              
              const incomeTotalNet = incomeSubData.reduce((sum, item) => sum + (item?.totalNet || 0), 0);
              
              reportData.push({
                category: { 
                  id: incomeType.id || 'income-header',
                  name: incomeType.name || 'Income',
                  type: incomeType.type || 'income',
                  level: incomeType.level || 'type',
                  isHeader: true 
                },
                monthlyData: incomeMonthlySubtotals,
                totalIncome: incomeTotalNet > 0 ? incomeTotalNet : 0,
                totalExpenditure: incomeTotalNet < 0 ? Math.abs(incomeTotalNet) : 0,
                totalNet: incomeTotalNet,
                showSubtotal: true
              });
              
              incomeSubData.forEach(data => {
                if (data && data.category) {
                  reportData.push({ ...data, isIndented: true });
                }
              });
            }
          }
        }
        
        if (expenseType && !incomeExpReportSettings.excludedCategories.includes(expenseType.id)) {
          const expenseSubs = categories.filter(c => 
            c.parentId === expenseType.id && 
            c.level === 'sub' &&
            !c.name.toLowerCase().includes('transfer') &&
            !incomeExpReportSettings.excludedCategories.includes(c.id)
          );

          if (expenseSubs.length > 0) {
            const expenseSubData = expenseSubs.map(sub => calculateCategoryData(sub))
              .filter(data => data.totalIncome > 0 || data.totalExpenditure > 0);

            if (expenseSubData.length > 0) {
              // Calculate monthly subtotals for expenses
              const expenseMonthlySubtotals = months.map(month => {
                const monthTotal = expenseSubData.reduce((sum, item) => {
                  if (!item || !item.monthlyData || !Array.isArray(item.monthlyData)) {
                    console.warn('Invalid item in expenseSubData:', item);
                    return sum;
                  }
                  const monthData = item.monthlyData.find((m: any) => m.month === month.key);
                  return sum + (monthData ? monthData.net : 0);
                }, 0);
                return {
                  month: month.key,
                  monthLabel: month.label,
                  income: monthTotal > 0 ? monthTotal : 0,
                  expenditure: monthTotal < 0 ? Math.abs(monthTotal) : 0,
                  net: monthTotal
                };
              });
              
              const expenseTotalNet = expenseSubData.reduce((sum, item) => sum + (item?.totalNet || 0), 0);
              
              reportData.push({
                category: { 
                  id: expenseType.id || 'expense-header',
                  name: expenseType.name || 'Expense',
                  type: expenseType.type || 'expense',
                  level: expenseType.level || 'type',
                  isHeader: true 
                },
                monthlyData: expenseMonthlySubtotals,
                totalIncome: expenseTotalNet > 0 ? expenseTotalNet : 0,
                totalExpenditure: expenseTotalNet < 0 ? Math.abs(expenseTotalNet) : 0,
                totalNet: expenseTotalNet,
                showSubtotal: true
              });
              
              expenseSubData.forEach(data => {
                if (data && data.category) {
                  reportData.push({ ...data, isIndented: true });
                }
              });
            }
          }
        }
      } else if (incomeExpReportSettings.categoryLevel === 'detail') {
        // Detail level - show full hierarchy
        if (incomeType && !incomeExpReportSettings.excludedCategories.includes(incomeType.id)) {
          const allIncomeDetailData: any[] = [];
          const incomeSubs = categories.filter(c => 
            c.parentId === incomeType.id && 
            c.level === 'sub' &&
            !c.name.toLowerCase().includes('transfer') &&
            !incomeExpReportSettings.excludedCategories.includes(c.id)
          );
          
          // Collect all detail data first
          incomeSubs.forEach(sub => {
            const subDetails = categories.filter(c => 
              c.parentId === sub.id && 
              !c.name.toLowerCase().includes('transfer') &&
              !incomeExpReportSettings.excludedCategories.includes(c.id)
            );
            subDetails.forEach(detail => {
              const data = calculateCategoryData(detail);
              if (data.totalIncome > 0 || data.totalExpenditure > 0) {
                allIncomeDetailData.push(data);
              }
            });
          });
          
          if (allIncomeDetailData.length > 0) {
            // Calculate income subtotals
            const incomeMonthlySubtotals = months.map(month => {
              const monthTotal = allIncomeDetailData.reduce((sum, item) => {
                const monthData = item.monthlyData.find((m: any) => m.month === month.key);
                return sum + (monthData ? monthData.net : 0);
              }, 0);
              return {
                month: month.key,
                monthLabel: month.label,
                income: monthTotal > 0 ? monthTotal : 0,
                expenditure: monthTotal < 0 ? Math.abs(monthTotal) : 0,
                net: monthTotal
              };
            });
            
            const incomeTotalNet = allIncomeDetailData.reduce((sum, item) => sum + item.totalNet, 0);
            
            reportData.push({
              category: { ...incomeType, isHeader: true },
              monthlyData: incomeMonthlySubtotals,
              totalIncome: incomeTotalNet > 0 ? incomeTotalNet : 0,
              totalExpenditure: incomeTotalNet < 0 ? Math.abs(incomeTotalNet) : 0,
              totalNet: incomeTotalNet,
              showSubtotal: true
            });
            
            // Now add sub-categories with their details
            incomeSubs.forEach(sub => {
              const subDetails = categories.filter(c => 
                c.parentId === sub.id && 
                !c.name.toLowerCase().includes('transfer') &&
                !incomeExpReportSettings.excludedCategories.includes(c.id)
              );
              
              const visibleDetails = subDetails.map(detail => calculateCategoryData(detail))
                .filter(data => data.totalIncome > 0 || data.totalExpenditure > 0);
              
              if (visibleDetails.length > 0) {
                reportData.push({
                  category: { ...sub, isHeader: true },
                  monthlyData: [],
                  totalIncome: 0,
                  totalExpenditure: 0,
                  totalNet: 0,
                  isIndented: true
                });
                
                visibleDetails.forEach(data => {
                  reportData.push({ ...data, isDoubleIndented: true });
                });
              }
            });
          }
        }
        
        if (expenseType && !incomeExpReportSettings.excludedCategories.includes(expenseType.id)) {
          const allExpenseDetailData: any[] = [];
          const expenseSubs = categories.filter(c => 
            c.parentId === expenseType.id && 
            c.level === 'sub' &&
            !c.name.toLowerCase().includes('transfer') &&
            !incomeExpReportSettings.excludedCategories.includes(c.id)
          );
          
          // Collect all detail data first
          expenseSubs.forEach(sub => {
            const subDetails = categories.filter(c => 
              c.parentId === sub.id && 
              !c.name.toLowerCase().includes('transfer') &&
              !incomeExpReportSettings.excludedCategories.includes(c.id)
            );
            subDetails.forEach(detail => {
              const data = calculateCategoryData(detail);
              if (data.totalIncome > 0 || data.totalExpenditure > 0) {
                allExpenseDetailData.push(data);
              }
            });
          });
          
          if (allExpenseDetailData.length > 0) {
            // Calculate expense subtotals
            const expenseMonthlySubtotals = months.map(month => {
              const monthTotal = allExpenseDetailData.reduce((sum, item) => {
                const monthData = item.monthlyData.find((m: any) => m.month === month.key);
                return sum + (monthData ? monthData.net : 0);
              }, 0);
              return {
                month: month.key,
                monthLabel: month.label,
                income: monthTotal > 0 ? monthTotal : 0,
                expenditure: monthTotal < 0 ? Math.abs(monthTotal) : 0,
                net: monthTotal
              };
            });
            
            const expenseTotalNet = allExpenseDetailData.reduce((sum, item) => sum + item.totalNet, 0);
            
            reportData.push({
              category: { ...expenseType, isHeader: true },
              monthlyData: expenseMonthlySubtotals,
              totalIncome: expenseTotalNet > 0 ? expenseTotalNet : 0,
              totalExpenditure: expenseTotalNet < 0 ? Math.abs(expenseTotalNet) : 0,
              totalNet: expenseTotalNet,
              showSubtotal: true
            });
            
            // Now add sub-categories with their details
            expenseSubs.forEach(sub => {
              const subDetails = categories.filter(c => 
                c.parentId === sub.id && 
                !c.name.toLowerCase().includes('transfer') &&
                !incomeExpReportSettings.excludedCategories.includes(c.id)
              );
              
              const visibleDetails = subDetails.map(detail => calculateCategoryData(detail))
                .filter(data => data.totalIncome > 0 || data.totalExpenditure > 0);
              
              if (visibleDetails.length > 0) {
                reportData.push({
                  category: { ...sub, isHeader: true },
                  monthlyData: [],
                  totalIncome: 0,
                  totalExpenditure: 0,
                  totalNet: 0,
                  isIndented: true
                });
                
                visibleDetails.forEach(data => {
                  reportData.push({ ...data, isDoubleIndented: true });
                });
              }
            });
          }
        }
      }

      // Calculate monthly totals from actual transactions
      const monthlyTotals = months.map(month => {
        const monthTransactions = transactions.filter(transaction => {
          const transactionDate = new Date(transaction.date);
          const transactionCategory = categories.find(c => c.id === transaction.category);
          if (!transactionCategory) return false;
          
          return transactionDate >= month.startDate && 
                 transactionDate <= month.endDate &&
                 !transactionCategory.name.toLowerCase().includes('transfer') &&
                 !isCategoryExcluded(transaction.category);
        });
        
        const income = monthTransactions
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0);
        
        const expenditure = monthTransactions
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + t.amount, 0);
        
        return {
          month: month.key,
          income,
          expenditure
        };
      });
      
      // Calculate grand totals from monthly totals
      const grandTotalIncome = monthlyTotals.reduce((sum, month) => sum + month.income, 0);
      const grandTotalExpenditure = monthlyTotals.reduce((sum, month) => sum + month.expenditure, 0);

      return {
        months,
        categories: reportData,
        monthlyTotals,
        grandTotalIncome,
        grandTotalExpenditure
      };
    } catch (error) {
      console.error('Error generating income/expenditure data:', error);
      return {
        months: [],
        categories: [],
        monthlyTotals: [],
        grandTotalIncome: 0,
        grandTotalExpenditure: 0
      };
    }
  }, [transactions, categories, incomeExpReportSettings]);

  // Handle onboarding completion
  const handleOnboardingComplete = (name: string, currency: string) => {
    setFirstName(name);
    setCurrency(currency);
    localStorage.setItem('onboardingCompleted', 'true');
    setShowOnboarding(false);
  };

  // Handle test data warning close
  const handleTestDataWarningClose = () => {
    setShowTestDataWarning(false);
    // Check if we should show onboarding after warning closes
    const onboardingCompleted = localStorage.getItem('onboardingCompleted');
    if (!onboardingCompleted && !firstName) {
      setShowOnboarding(true);
    }
  };

  // Modal helpers
  const openModal = (type: typeof modalState.type, title: string, data?: any) => {
    setModalState({
      isOpen: true,
      type,
      title,
      data
    });
  };

  const closeModal = () => {
    setModalState({
      isOpen: false,
      type: null,
      title: ''
    });
  };

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold text-blue-900 dark:text-white mb-2">
        Welcome back, {firstName || 'User'}!
      </h1>
      <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mb-4 md:mb-6">
        Here's your financial overview
      </p>

      {/* Summary Cards */}
      <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mb-3">
        Click any card to view details
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
        <div 
          className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-blue-100 dark:border-gray-700 p-4 md:p-6 cursor-pointer hover:shadow-lg hover:border-blue-200 transition-all"
          onClick={() => navigate('/networth')}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Net Worth</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {isLoading ? '...' : formatCurrency(netWorth)}
              </p>
            </div>
            <DollarSign className="text-primary ml-2" size={20} />
          </div>
        </div>

        <div 
          className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-blue-100 dark:border-gray-700 p-4 md:p-6 cursor-pointer hover:shadow-lg hover:border-blue-200 transition-all"
          onClick={() => navigate('/networth/assets')}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Total Assets</p>
              <p className="text-xl md:text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                {isLoading ? '...' : formatCurrency(totalAssets)}
              </p>
            </div>
            <TrendingUp className="text-green-500 ml-2" size={20} />
          </div>
        </div>

        <div 
          className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-blue-100 dark:border-gray-700 p-4 md:p-6 cursor-pointer hover:shadow-lg hover:border-blue-200 transition-all"
          onClick={() => navigate('/networth/liabilities')}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Total Liabilities</p>
              <p className="text-xl md:text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                {isLoading ? '...' : formatCurrency(totalLiabilities)}
              </p>
            </div>
            <TrendingDown className="text-red-500 ml-2" size={20} />
          </div>
        </div>

      </div>

      {/* Charts and Additional Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
        {/* Net Worth Over Time Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-blue-100 dark:border-gray-700 p-4 md:p-6">
          <div className="mb-3 md:mb-4">
            <h2 
              className="text-lg md:text-xl font-semibold text-blue-900 dark:text-white cursor-pointer hover:text-primary transition-colors"
              onClick={() => openModal('networth-chart', 'Net Worth Over Time', netWorthData)}
            >
              Net Worth Over Time
            </h2>
            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
              Click title for expanded view • Click any bar to see detailed breakdown
            </p>
          </div>
          <div className="h-48 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={netWorthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis 
                  dataKey="month" 
                  stroke="#6B7280"
                  fontSize={12}
                  tickFormatter={(value) => value.slice(0, 3)}
                />
                <YAxis 
                  stroke="#6B7280"
                  fontSize={12}
                  tickFormatter={(value) => {
                    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                    return value.toString();
                  }}
                />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), 'Net Worth']}
                  contentStyle={chartStyles.tooltip}
                />
                <Bar 
                  dataKey="netWorth" 
                  fill="#8B5CF6" 
                  radius={[4, 4, 0, 0]}
                  style={{ cursor: 'pointer' }}
                  onClick={(data: any) => {
                    if (data && data.month) {
                      navigate(`/networth/monthly/${data.month}`);
                    }
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-blue-100 dark:border-gray-700 p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3 md:mb-4 gap-1">
            <h2 
              className="text-lg md:text-xl font-semibold text-blue-900 dark:text-white cursor-pointer hover:text-primary transition-colors"
              onClick={() => openModal('account-distribution', 'Account Distribution', pieData)}
            >
              Account Distribution
            </h2>
            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
              Click title for expanded view • Click to view transactions
            </p>
          </div>
          <div className="h-48 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  onClick={(data) => {
                    navigate(`/transactions?account=${data.id}`);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={chartStyles.pieTooltip}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Outstanding Reconciliation Summary */}
      {reconciliationDetails.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-6 mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 md:mb-4 gap-2">
            <div className="flex items-center gap-2">
              <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
              <h2 
                className="text-lg md:text-xl font-semibold text-blue-900 dark:text-white cursor-pointer hover:text-primary transition-colors"
                onClick={() => openModal('reconciliation', 'Outstanding Reconciliations', reconciliationDetails)}
              >
                Outstanding Reconciliations
              </h2>
            </div>
            <div 
              className="sm:text-right cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => navigate('/reconciliation')}
            >
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Total Outstanding</p>
              <p className="text-base md:text-lg font-bold text-orange-600 dark:text-orange-400">
                {reconciliationDetails.reduce((sum, acc) => sum + acc.unreconciledCount, 0)} items
              </p>
            </div>
          </div>
          
          <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-3 md:mb-4">
            {reconciliationDetails.length} account{reconciliationDetails.length !== 1 ? 's' : ''} with unreconciled bank transactions.
          </p>

          {/* Summary Table */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg overflow-x-auto">
            <div className="min-w-[300px]">
              <div className="grid grid-cols-3 gap-2 sm:gap-4 p-2 sm:p-3 bg-gray-100 dark:bg-gray-600 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                <div>Account</div>
                <div className="text-center">Unreconciled</div>
                <div className="text-center">Total Amount</div>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-600">
                {reconciliationDetails.map(account => (
                  <div 
                    key={account.account.id}
                    className="grid grid-cols-3 gap-2 sm:gap-4 p-2 sm:p-3 hover:bg-gray-100 dark:hover:bg-gray-500 cursor-pointer transition-colors"
                    onClick={() => navigate(`/reconciliation?account=${account.account.id}`)}
                  >
                    <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate">
                      {account.account.name}
                    </div>
                    <div className="text-center text-xs sm:text-sm font-medium text-orange-600 dark:text-orange-400">
                      {account.unreconciledCount}
                    </div>
                    <div className="text-center text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      {formatCurrency(account.totalToReconcile)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Summary Statistics */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-3 md:mt-4">
            <div className="text-center p-2 sm:p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-400">Accounts</p>
              <p className="text-base sm:text-lg font-bold text-blue-700 dark:text-blue-300">{reconciliationDetails.length}</p>
            </div>
            <div 
              className="text-center p-2 sm:p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
              onClick={() => navigate('/reconciliation')}
            >
              <p className="text-xs sm:text-sm text-orange-600 dark:text-orange-400">Unreconciled</p>
              <p className="text-base sm:text-lg font-bold text-orange-700 dark:text-orange-300">
                {reconciliationDetails.reduce((sum, acc) => sum + acc.unreconciledCount, 0)}
              </p>
            </div>
            <div className="text-center p-2 sm:p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-xs sm:text-sm text-green-600 dark:text-green-400">Total Value</p>
              <p className="text-base sm:text-lg font-bold text-green-700 dark:text-green-300">
                {formatCurrency(reconciliationDetails.reduce((sum, acc) => sum + acc.totalToReconcile, 0))}
              </p>
            </div>
          </div>

          <div className="mt-3 md:mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              💡 <strong>Tip:</strong> Click on any account row to start reconciliation. Focus on accounts with the highest number of outstanding items first.
            </p>
          </div>
        </div>
      )}

      {/* Income and Expenditure over Time */}
      {(incomeExpenditureData.categories.length > 0 || true) && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-6 mb-6 md:mb-8">
          <ErrorBoundary>
            <IncomeExpenditureReport
                data={incomeExpenditureData}
                settings={incomeExpReportSettings}
                setSettings={setIncomeExpReportSettings}
                categories={categories}
                transactions={transactions}
                accounts={accounts}
                isModal={false}
                onOpenModal={() => openModal(
                  'income-expenditure',
                  'Income and Expenditure over Time',
                  {
                    ...incomeExpenditureData,
                    settings: incomeExpReportSettings,
                    setSettings: setIncomeExpReportSettings,
                    categories: categories,
                    transactions: transactions,
                    accounts: accounts
                  }
                )}
              />
          </ErrorBoundary>
        </div>
      )}


      {/* Recent Transactions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-6">
        <h2 className="text-lg md:text-xl font-semibold mb-2 md:mb-3 text-blue-900 dark:text-white">Recent Transactions</h2>
        <div className="space-y-1">
          {transactions.slice(0, 10).map(transaction => (
            <div key={transaction.id} className="flex items-center gap-3 py-1.5 border-b dark:border-gray-700/50 last:border-0">
              <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap w-12">
                {new Date(transaction.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              </span>
              <p className="text-sm font-medium dark:text-white truncate flex-1">{transaction.description}</p>
              <span className={`text-sm font-semibold whitespace-nowrap ${
                transaction.type === 'income' 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {formatCurrency(transaction.amount)}
              </span>
            </div>
          ))}
          {transactions.length === 0 && (
            <p className="text-gray-500 dark:text-gray-400 text-center py-6">
              No transactions yet
            </p>
          )}
        </div>
      </div>
      
      {/* Test Data Warning Modal */}
      <TestDataWarningModal
        isOpen={showTestDataWarning}
        onClose={handleTestDataWarningClose}
        onClearData={() => {
          clearAllData();
          handleTestDataWarningClose();
        }}
      />

      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={handleOnboardingComplete}
      />

      {/* Dashboard Modal */}
      <DashboardModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        title={modalState.title}
        type={modalState.type}
        data={modalState.data}
        chartStyles={chartStyles}
      />
    </div>
  );
}