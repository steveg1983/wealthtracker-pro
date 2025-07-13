import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { PlusCircle } from 'lucide-react';

export default function BudgetTest() {
  console.log('BudgetTest component rendering');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Get data from context
  let context: any = null;
  try {
    context = useApp();
    console.log('Context loaded:', context);
  } catch (error) {
    console.error('Error loading context:', error);
    return <div>Error loading context: {String(error)}</div>;
  }
  
  const { budgets = [], transactions = [] } = context || {};
  
  console.log('Budgets:', budgets);
  console.log('Transactions:', transactions);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Budget Test</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors"
        >
          <PlusCircle size={20} />
          Add Budget
        </button>
      </div>
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <p>Number of budgets: {budgets.length}</p>
        <p>Number of transactions: {transactions.length}</p>
        <p>Modal open: {isModalOpen ? 'Yes' : 'No'}</p>
      </div>
      
      {/* No modal import - just show state */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Modal would be here</h2>
            <button 
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 bg-gray-500 text-white rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}