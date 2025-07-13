import { useApp } from '../contexts/AppContext';

export default function BudgetDebug() {
  
  try {
    const appContext = useApp();
    
    if (!appContext) {
      return <div className="p-8">Error: App context not available</div>;
    }
    
    const { budgets, transactions, updateBudget, deleteBudget } = appContext;
    
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Budget Debug</h1>
        <div className="space-y-2">
          <p>✓ App context loaded</p>
          <p>✓ Budgets: {budgets ? `${budgets.length} items` : 'null/undefined'}</p>
          <p>✓ Transactions: {transactions ? `${transactions.length} items` : 'null/undefined'}</p>
          <p>✓ updateBudget: {typeof updateBudget}</p>
          <p>✓ deleteBudget: {typeof deleteBudget}</p>
        </div>
        
        {budgets && budgets.length > 0 && (
          <div className="mt-4">
            <h2 className="text-lg font-semibold">First Budget:</h2>
            <pre className="bg-gray-100 p-2 rounded mt-2">
              {JSON.stringify(budgets[0], null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  } catch (err) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4 text-red-600">Budget Error</h1>
        <pre className="bg-red-100 p-4 rounded">
          {err instanceof Error ? err.message : String(err)}
        </pre>
      </div>
    );
  }
}