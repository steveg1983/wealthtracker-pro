import React from 'react';
import PageWrapper from '../components/PageWrapper';
import HouseholdManagement from '../components/HouseholdManagement';
import { UsersIcon } from '../components/icons';

export default function HouseholdManagementPage() {
  return (
    <PageWrapper 
      title="Household Management"
      rightContent={
        <div className="cursor-pointer" title="Household Management">
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
              fill="#6366F1"
              className="transition-all duration-200"
              onMouseEnter={(e) => e.currentTarget.setAttribute('fill', '#4F46E5')}
              onMouseLeave={(e) => e.currentTarget.setAttribute('fill', '#6366F1')}
            />
            <g transform="translate(12, 12)">
              <UsersIcon size={24} className="text-white" />
            </g>
          </svg>
        </div>
      }
    >
      <HouseholdManagement />
    </PageWrapper>
  );
}