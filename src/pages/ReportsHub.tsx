import { useState, lazy, Suspense } from 'react';
import { BarChart3Icon, TrendingUpIcon, FileTextIcon } from '../components/icons';
import PageTip from '../components/PageTip';
import { SkeletonCard } from '../components/loading/Skeleton';

// Lazy load each report view
const Reports = lazy(() => import('./Reports'));
const FinancialSummaries = lazy(() => import('./FinancialSummaries'));
const CustomReports = lazy(() => import('./CustomReports'));

type ReportTab = 'income-expense' | 'net-worth' | 'custom';

const tabs: { id: ReportTab; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'income-expense', label: 'Income & Expense', icon: BarChart3Icon, description: 'Breakdown of earning and spending' },
  { id: 'net-worth', label: 'Net Worth', icon: TrendingUpIcon, description: 'Assets, liabilities, and trends' },
  { id: 'custom', label: 'Custom Reports', icon: FileTextIcon, description: 'Build your own reports' },
];

export default function ReportsHub() {
  const [activeTab, setActiveTab] = useState<ReportTab>('income-expense');

  return (
    <div className="space-y-0">
      {/* Tab navigation */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 -mx-4 md:-mx-6 lg:-mx-8 -mt-4 md:-mt-6 lg:-mt-8 mb-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center justify-between py-4 px-4 md:px-0">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Reports</h1>
          </div>
          {/* role="tab" requires a role="tablist" parent (WCAG 1.3.1 / axe
              aria-required-parent) */}
          <div role="tablist" aria-label="Report tabs" className="flex gap-1 px-4 md:px-0 -mb-px overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-[#1a2332] text-[#1a2332] dark:border-blue-400 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                  }`}
                  aria-selected={isActive}
                  role="tab"
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <Suspense fallback={<SkeletonCard className="h-96" />}>
        {activeTab === 'income-expense' && <Reports />}
        {activeTab === 'net-worth' && <FinancialSummaries />}
        {activeTab === 'custom' && <CustomReports />}
      </Suspense>

      <PageTip
        id="reports-intro"
        title="Financial reports"
        description="Switch between Income & Expense, Net Worth, and Custom Reports using the tabs above. Each report can be filtered by date range and account."
      />
    </div>
  );
}
