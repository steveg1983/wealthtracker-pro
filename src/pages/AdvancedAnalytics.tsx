import React from 'react';
import PageWrapper from '../components/PageWrapper';
import AdvancedAnalytics from '../components/AdvancedAnalytics';
import BillNegotiator from '../components/BillNegotiator';
import { MagicWandIcon } from '../components/icons';

export default function AdvancedAnalyticsPage() {
  return (
    <PageWrapper 
      title="AI Analytics"
      rightContent={
        <div className="cursor-pointer" title="AI-Powered Analytics">
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            xmlns="http://www.w3.org/2000/svg"
            className="transition-all duration-200 hover:scale-110 drop-shadow-lg hover:drop-shadow-xl"
            style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))' }}
          >
            <circle
              cx="24"
              cy="24"
              r="24"
              fill="#E9D5FF"
              className="transition-all duration-200"
              onMouseEnter={(e) => e.currentTarget.setAttribute('fill', '#DDD6FE')}
              onMouseLeave={(e) => e.currentTarget.setAttribute('fill', '#E9D5FF')}
            />
            <g transform="translate(12, 12)">
              <MagicWandIcon size={24} className="text-purple-600" />
            </g>
          </svg>
        </div>
      }
    >
      <div className="space-y-8">
        {/* Advanced Analytics Component */}
        <AdvancedAnalytics />
        
        {/* Bill Negotiator Component */}
        <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-2xl shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
            Bill Negotiation Assistant
          </h2>
          <BillNegotiator />
        </div>
      </div>
    </PageWrapper>
  );
}