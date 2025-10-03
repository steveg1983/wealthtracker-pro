import { memo, useEffect } from 'react';
import { useLogger } from '../services/ServiceProvider';

interface BudgetHeaderProps {
  onAddBudget: () => void;
}

export const BudgetHeader = memo(function BudgetHeader({ onAddBudget  }: BudgetHeaderProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('BudgetHeader component initialized', {
      componentName: 'BudgetHeader'
    });
  }, []);

  return (
    <div 
      onClick={onAddBudget}
      className="cursor-pointer"
      title="Add Budget"
    >
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
          fill="#D9E1F2"
          className="transition-all duration-200"
          onMouseEnter={(e) => e.currentTarget.setAttribute('fill', '#C5D3E8')}
          onMouseLeave={(e) => e.currentTarget.setAttribute('fill', '#D9E1F2')}
        />
        <g transform="translate(12, 12)">
          <circle cx="12" cy="12" r="10" stroke="#1F2937" strokeWidth="2" fill="none" />
          <path d="M12 8v8M8 12h8" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
});