import React from 'react';
import PageWrapper from '../components/PageWrapper';
import TaxPlanning from '../components/TaxPlanning';
import { CalculatorIcon } from '../components/icons';

export default function TaxPlanningPage() {
  return (
    <PageWrapper 
      title="Tax Planning"
      rightContent={
        <div className="cursor-pointer" title="Tax Planning & Optimization">
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
              fill="#D4F4DD"
              className="transition-all duration-200"
              onMouseEnter={(e) => e.currentTarget.setAttribute('fill', '#C3E9D0')}
              onMouseLeave={(e) => e.currentTarget.setAttribute('fill', '#D4F4DD')}
            />
            <g transform="translate(12, 12)">
              <CalculatorIcon size={24} className="text-green-600" />
            </g>
          </svg>
        </div>
      }
    >
      <TaxPlanning />
    </PageWrapper>
  );
}