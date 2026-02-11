import React, { useState } from 'react';
import PageWrapper from '../components/PageWrapper';
import SmartCategorizationSettings from '../components/SmartCategorizationSettings';
import AnomalyDetection from '../components/AnomalyDetection';
import BudgetRecommendations from '../components/BudgetRecommendations';
import { MagicWandIcon, LightbulbIcon, AlertTriangleIcon, TargetIcon } from '../components/icons';

export default function AIFeatures() {
  const [activeTab, setActiveTab] = useState<'categorization' | 'anomalies' | 'budgets'>('categorization');

  return (
    <PageWrapper 
      title="AI-Powered Features"
      rightContent={
        <div className="cursor-pointer" title="AI-Powered Features">
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            xmlns="http://www.w3.org/2000/svg"
            className="transition-all duration-200 hover:scale-110 drop-shadow-lg hover:drop-shadow-xl"
            style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))' }}
          >
            <defs>
              <linearGradient id="ai-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#A78BFA" />
                <stop offset="100%" stopColor="#7C3AED" />
              </linearGradient>
            </defs>
            <circle
              cx="24"
              cy="24"
              r="24"
              fill="url(#ai-gradient)"
            />
            <g transform="translate(12, 12)">
              <MagicWandIcon size={24} className="text-white" />
            </g>
          </svg>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-xl shadow p-1 flex">
          <button
            onClick={() => setActiveTab('categorization')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'categorization'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <LightbulbIcon size={20} />
            <span className="font-medium">Smart Categorization</span>
          </button>
          <button
            onClick={() => setActiveTab('anomalies')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'anomalies'
                ? 'bg-red-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <AlertTriangleIcon size={20} />
            <span className="font-medium">Anomaly Detection</span>
          </button>
          <button
            onClick={() => setActiveTab('budgets')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'budgets'
                ? 'bg-purple-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <TargetIcon size={20} />
            <span className="font-medium">Budget Recommendations</span>
          </button>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'categorization' && <SmartCategorizationSettings />}
          {activeTab === 'anomalies' && <AnomalyDetection />}
          {activeTab === 'budgets' && <BudgetRecommendations />}
        </div>
      </div>
    </PageWrapper>
  );
}