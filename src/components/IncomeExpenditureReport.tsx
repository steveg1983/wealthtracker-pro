import { Settings, Maximize2 } from 'lucide-react';
import { useCurrency } from '../hooks/useCurrency';

interface IncomeExpenditureReportProps {
  data: any;
  settings: any;
  setSettings: (settings: any) => void;
  categories: any[];
  isModal?: boolean;
  onOpenModal?: () => void;
}

export default function IncomeExpenditureReport({ 
  data, 
  settings, 
  setSettings, 
  categories,
  isModal = false,
  onOpenModal
}: IncomeExpenditureReportProps) {
  const { formatCurrency } = useCurrency();
  
  // Validate data structure
  if (!data || !data.months || !data.categories || !Array.isArray(data.months) || !Array.isArray(data.categories)) {
    console.error('Invalid data structure provided to IncomeExpenditureReport:', data);
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>Unable to display report. Please check your data.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
        {!isModal ? (
          <div className="flex items-center gap-2">
            <h2 className="text-lg md:text-xl font-semibold dark:text-white">
              Income and Expenditure over Time
            </h2>
            {onOpenModal && (
              <button
                onClick={onOpenModal}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Fullscreen view"
              >
                <Maximize2 size={18} className="text-gray-500 dark:text-gray-400" />
              </button>
            )}
          </div>
        ) : null}
        <div className={`flex items-center gap-3 ${isModal ? 'w-full justify-between' : ''}`}>
          <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
            {settings.timePeriod === '1month' ? 'Last month' :
             settings.timePeriod === '12months' ? 'Last 12 months' :
             settings.timePeriod === '24months' ? 'Last 24 months' :
             'Custom period'} • {settings.categoryLevel === 'type' ? 'Type level' : 
             settings.categoryLevel === 'sub' ? 'Sub-category level' : 'Detail level'}
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSettings((prev: any) => ({ ...prev, showSettings: !prev.showSettings }));
            }}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Report settings"
          >
            <Settings size={18} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      </div>
      
      {/* Settings Panel */}
      {settings.showSettings && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-4">
          {/* Category Level */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Category Level</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSettings((prev: any) => ({ ...prev, categoryLevel: 'type' }))}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  settings.categoryLevel === 'type'
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                }`}
              >
                Income/Expense Only
              </button>
              <button
                onClick={() => setSettings((prev: any) => ({ ...prev, categoryLevel: 'sub' }))}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  settings.categoryLevel === 'sub'
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                }`}
              >
                Sub-Categories
              </button>
              <button
                onClick={() => setSettings((prev: any) => ({ ...prev, categoryLevel: 'detail' }))}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  settings.categoryLevel === 'detail'
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                }`}
              >
                Detailed Categories
              </button>
            </div>
          </div>

          {/* Time Period */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Time Period</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSettings((prev: any) => ({ ...prev, timePeriod: '1month' }))}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  settings.timePeriod === '1month'
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                }`}
              >
                Past Month
              </button>
              <button
                onClick={() => setSettings((prev: any) => ({ ...prev, timePeriod: '12months' }))}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  settings.timePeriod === '12months'
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                }`}
              >
                Past 12 Months
              </button>
              <button
                onClick={() => setSettings((prev: any) => ({ ...prev, timePeriod: '24months' }))}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  settings.timePeriod === '24months'
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                }`}
              >
                Past 24 Months
              </button>
              <button
                onClick={() => setSettings((prev: any) => ({ ...prev, timePeriod: 'custom' }))}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  settings.timePeriod === 'custom'
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                }`}
              >
                Custom Range
              </button>
            </div>
            
            {settings.timePeriod === 'custom' && (
              <div className="mt-3 flex gap-3 items-center">
                <input
                  type="date"
                  value={settings.customStartDate}
                  onChange={(e) => setSettings((prev: any) => ({ ...prev, customStartDate: e.target.value }))}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">to</span>
                <input
                  type="date"
                  value={settings.customEndDate}
                  onChange={(e) => setSettings((prev: any) => ({ ...prev, customEndDate: e.target.value }))}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            )}
          </div>

          {/* Excluded Categories */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Category Selection
              {settings.excludedCategories.length > 0 && 
                <span className="ml-2 text-xs text-gray-500">
                  ({settings.excludedCategories.length} excluded)
                </span>
              }
            </label>
            <button
              onClick={() => setSettings((prev: any) => ({ ...prev, showCategoryModal: true }))}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors text-sm"
            >
              Manage Category Selection
            </button>
          </div>

          <button
            onClick={() => setSettings((prev: any) => ({ ...prev, showSettings: false }))}
            className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors text-sm"
          >
            Close Settings
          </button>
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-3 px-2 font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-800 min-w-[120px]">
                Category
              </th>
              {data.months.map((month: any) => (
                <th key={month.key} className="text-center py-3 px-2 font-medium text-gray-500 dark:text-gray-400 min-w-[80px]">
                  {month.label}
                </th>
              ))}
              <th className="text-right py-3 px-2 font-medium text-gray-900 dark:text-white sticky right-0 bg-white dark:bg-gray-800 min-w-[100px]">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {data.categories.map((categoryData: any) => {
              // Skip invalid category data
              if (!categoryData || !categoryData.category || !categoryData.category.id) {
                console.warn('Skipping invalid category data:', categoryData);
                return null;
              }
              
              return (
              <tr 
                key={categoryData.category.id} 
                className={`
                  ${categoryData.category.isHeader && !categoryData.isIndented
                    ? 'bg-gray-100 dark:bg-gray-700/70 border-t-2 border-b-2 border-gray-400 dark:border-gray-500' 
                    : categoryData.category.isHeader && categoryData.isIndented
                    ? 'bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-600'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700'
                  }
                `}
              >
                <td className={`py-2.5 px-2 sticky left-0 ${
                  categoryData.category.isHeader && !categoryData.isIndented
                    ? 'bg-gray-100 dark:bg-gray-700/70 text-gray-800 dark:text-gray-200 font-semibold text-sm uppercase tracking-wider' 
                    : categoryData.category.isHeader && categoryData.isIndented
                    ? 'bg-gray-50 dark:bg-gray-700/30 text-gray-700 dark:text-gray-300 font-medium text-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm'
                } ${
                  categoryData.isIndented ? 'pl-8' : 
                  categoryData.isDoubleIndented ? 'pl-14' : 'pl-3'
                }`}>
                  {categoryData.category.name}
                </td>
                {categoryData.category.isHeader && !categoryData.showSubtotal ? (
                  // Empty cells for headers without subtotals
                  data.months.map((month: any) => (
                    <td key={month.key} className={`py-2.5 px-2 text-center ${
                      categoryData.isIndented 
                        ? 'bg-gray-50 dark:bg-gray-700/30' 
                        : 'bg-gray-100 dark:bg-gray-700/70'
                    }`}>
                      <div className="text-xs text-gray-400"></div>
                    </td>
                  ))
                ) : categoryData.showSubtotal && Array.isArray(categoryData.monthlyData) ? (
                  // Subtotal cells for category headers
                  categoryData.monthlyData.map((monthData: any) => (
                    <td key={monthData.month} className="py-2.5 px-1 text-center bg-gray-100 dark:bg-gray-700/70">
                      {monthData.net !== 0 && (
                        <div className={`text-xs font-bold ${
                          monthData.net > 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                        }`}>
                          {formatCurrency(monthData.net)}
                        </div>
                      )}
                      {monthData.net === 0 && (
                        <div className="text-xs font-medium text-gray-500">-</div>
                      )}
                    </td>
                  ))
                ) : Array.isArray(categoryData.monthlyData) ? (
                  // Normal data cells
                  categoryData.monthlyData.map((monthData: any) => (
                    <td key={monthData.month} className="py-2.5 px-1 text-center">
                      {monthData.income > 0 && (
                        <div className="text-sm text-green-600 dark:text-green-400">
                          {formatCurrency(monthData.income)}
                        </div>
                      )}
                      {monthData.expenditure > 0 && (
                        <div className="text-sm text-red-600 dark:text-red-400">
                          {formatCurrency(monthData.expenditure)}
                        </div>
                      )}
                      {monthData.income === 0 && monthData.expenditure === 0 && (
                        <div className="text-xs text-gray-300 dark:text-gray-600">-</div>
                      )}
                    </td>
                  ))
                ) : (
                  // Fallback when monthlyData is not available
                  data.months.map((month: any) => (
                    <td key={month.key} className="py-2.5 px-1 text-center">
                      <div className="text-xs text-gray-300 dark:text-gray-600">-</div>
                    </td>
                  ))
                )}
                <td className={`py-2.5 px-2 text-right sticky right-0 ${
                  categoryData.category.isHeader && !categoryData.isIndented
                    ? 'bg-gray-100 dark:bg-gray-700/70' 
                    : categoryData.category.isHeader && categoryData.isIndented
                    ? 'bg-gray-50 dark:bg-gray-700/30'
                    : 'bg-white dark:bg-gray-800'
                }`}>
                  {categoryData.category.isHeader && !categoryData.showSubtotal ? (
                    <div className="text-xs text-gray-400"></div>
                  ) : categoryData.showSubtotal ? (
                    <div className={`text-sm font-bold ${
                      categoryData.totalNet >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                    }`}>
                      {formatCurrency(categoryData.totalNet)}
                    </div>
                  ) : (
                    <>
                      {categoryData.totalIncome > 0 && (
                        <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                          {formatCurrency(categoryData.totalIncome)}
                        </div>
                      )}
                      {categoryData.totalExpenditure > 0 && (
                        <div className="text-sm font-semibold text-red-600 dark:text-red-400">
                          {formatCurrency(categoryData.totalExpenditure)}
                        </div>
                      )}
                      {categoryData.totalIncome === 0 && categoryData.totalExpenditure === 0 && (
                        <div className="text-xs text-gray-300 dark:text-gray-600">-</div>
                      )}
                    </>
                  )}
                </td>
              </tr>
              );
            })}
            
            {/* TOTALS Row */}
            <tr className="border-t-2 border-gray-400 dark:border-gray-500 bg-gray-100 dark:bg-gray-700/70">
              <td className="py-3 px-3 font-bold text-gray-900 dark:text-white sticky left-0 bg-gray-100 dark:bg-gray-700/70 uppercase text-sm tracking-wider">
                TOTALS
              </td>
              {Array.isArray(data.monthlyTotals) ? data.monthlyTotals.map((monthTotal: any) => {
                const netAmount = monthTotal.income - monthTotal.expenditure;
                return (
                  <td key={monthTotal.month} className="py-3 px-1 text-center bg-gray-100 dark:bg-gray-700/70">
                    {netAmount !== 0 ? (
                      <div className={`text-xs font-bold ${
                        netAmount > 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                      }`}>
                        {formatCurrency(netAmount)}
                      </div>
                    ) : (
                      <div className="text-xs font-medium text-gray-500">-</div>
                    )}
                  </td>
                );
              }) : (
                // Fallback when monthlyTotals is not available
                data.months.map((month: any) => (
                  <td key={month.key} className="py-3 px-1 text-center bg-gray-100 dark:bg-gray-700/70">
                    <div className="text-xs font-medium text-gray-500">-</div>
                  </td>
                ))
              )}
              <td className="py-3 px-2 text-right sticky right-0 bg-gray-100 dark:bg-gray-700/70">
                {(() => {
                  const grandNet = data.grandTotalIncome - data.grandTotalExpenditure;
                  return grandNet !== 0 ? (
                    <div className={`text-sm font-bold ${
                      grandNet > 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                    }`}>
                      {formatCurrency(grandNet)}
                    </div>
                  ) : (
                    <div className="text-sm font-medium text-gray-500">-</div>
                  );
                })()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {!isModal && (
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            📊 <strong>Tip:</strong> Green shows income, red shows expenditure. Use the settings to adjust time period and category display level.
          </p>
        </div>
      )}

      {/* Category Selection Modal */}
      {settings.showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Select Categories for Report
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Unchecked categories will be excluded from the report
              </p>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="mb-4 flex gap-2">
                <button
                  onClick={() => setSettings((prev: any) => ({ ...prev, excludedCategories: [] }))}
                  className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={() => {
                    const allCategoryIds = categories
                      .filter(cat => !cat.name.toLowerCase().includes('transfer'))
                      .map(cat => cat.id);
                    setSettings((prev: any) => ({ ...prev, excludedCategories: allCategoryIds }));
                  }}
                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Deselect All
                </button>
              </div>

              {/* Income Categories */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Income</h3>
                {categories
                  .filter(cat => cat.level === 'type' && cat.name === 'Income')
                  .map(incomeType => (
                    <div key={incomeType.id}>
                      {/* Income sub-categories */}
                      {categories
                        .filter(cat => cat.parentId === incomeType.id && !cat.name.toLowerCase().includes('transfer'))
                        .map(subCat => (
                          <div key={subCat.id} className="ml-4 mb-2">
                            <label className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!settings.excludedCategories.includes(subCat.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSettings((prev: any) => ({
                                      ...prev,
                                      excludedCategories: prev.excludedCategories.filter((id: string) => id !== subCat.id)
                                    }));
                                  } else {
                                    setSettings((prev: any) => ({
                                      ...prev,
                                      excludedCategories: [...prev.excludedCategories, subCat.id]
                                    }));
                                  }
                                }}
                                className="rounded border-gray-300 text-primary focus:ring-primary"
                              />
                              <span className="font-medium text-gray-700 dark:text-gray-300">{subCat.name}</span>
                            </label>
                            
                            {/* Detail categories */}
                            {categories
                              .filter(cat => cat.parentId === subCat.id)
                              .map(detailCat => (
                                <label key={detailCat.id} className="flex items-center gap-2 p-2 ml-8 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={!settings.excludedCategories.includes(detailCat.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSettings((prev: any) => ({
                                          ...prev,
                                          excludedCategories: prev.excludedCategories.filter((id: string) => id !== detailCat.id)
                                        }));
                                      } else {
                                        setSettings((prev: any) => ({
                                          ...prev,
                                          excludedCategories: [...prev.excludedCategories, detailCat.id]
                                        }));
                                      }
                                    }}
                                    className="rounded border-gray-300 text-primary focus:ring-primary"
                                  />
                                  <span className="text-gray-700 dark:text-gray-300">{detailCat.name}</span>
                                </label>
                              ))}
                          </div>
                        ))}
                    </div>
                  ))}
              </div>

              {/* Expense Categories */}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Expenses</h3>
                {categories
                  .filter(cat => cat.level === 'type' && cat.name === 'Expense')
                  .map(expenseType => (
                    <div key={expenseType.id}>
                      {/* Expense sub-categories */}
                      {categories
                        .filter(cat => cat.parentId === expenseType.id && !cat.name.toLowerCase().includes('transfer'))
                        .map(subCat => (
                          <div key={subCat.id} className="ml-4 mb-2">
                            <label className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!settings.excludedCategories.includes(subCat.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSettings((prev: any) => ({
                                      ...prev,
                                      excludedCategories: prev.excludedCategories.filter((id: string) => id !== subCat.id)
                                    }));
                                  } else {
                                    setSettings((prev: any) => ({
                                      ...prev,
                                      excludedCategories: [...prev.excludedCategories, subCat.id]
                                    }));
                                  }
                                }}
                                className="rounded border-gray-300 text-primary focus:ring-primary"
                              />
                              <span className="font-medium text-gray-700 dark:text-gray-300">{subCat.name}</span>
                            </label>
                            
                            {/* Detail categories */}
                            {categories
                              .filter(cat => cat.parentId === subCat.id)
                              .map(detailCat => (
                                <label key={detailCat.id} className="flex items-center gap-2 p-2 ml-8 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={!settings.excludedCategories.includes(detailCat.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSettings((prev: any) => ({
                                          ...prev,
                                          excludedCategories: prev.excludedCategories.filter((id: string) => id !== detailCat.id)
                                        }));
                                      } else {
                                        setSettings((prev: any) => ({
                                          ...prev,
                                          excludedCategories: [...prev.excludedCategories, detailCat.id]
                                        }));
                                      }
                                    }}
                                    className="rounded border-gray-300 text-primary focus:ring-primary"
                                  />
                                  <span className="text-gray-700 dark:text-gray-300">{detailCat.name}</span>
                                </label>
                              ))}
                          </div>
                        ))}
                    </div>
                  ))}
              </div>
            </div>
            
            <div className="p-6 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setSettings((prev: any) => ({ ...prev, showCategoryModal: false }))}
                className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Apply Selection
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}