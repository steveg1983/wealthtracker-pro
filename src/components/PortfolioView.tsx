import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { formatCurrency } from '../utils/currency';

interface Holding {
  ticker: string;
  name: string;
  shares: number;
  value: number;
}

interface PortfolioViewProps {
  accountId: string;
  accountName: string;
  holdings: Holding[];
  currency: string;
  onClose: () => void;
}

export default function PortfolioView({ 
  accountId, 
  accountName, 
  holdings, 
  currency,
  onClose 
}: PortfolioViewProps) {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<'value' | 'shares' | 'name'>('value');
  
  const totalValue = holdings.reduce((sum, holding) => sum + holding.value, 0);
  
  const sortedHoldings = [...holdings].sort((a, b) => {
    switch (sortBy) {
      case 'value':
        return b.value - a.value;
      case 'shares':
        return b.shares - a.shares;
      case 'name':
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });
  
  const getPercentage = (value: number) => {
    return ((value / totalValue) * 100).toFixed(1);
  };
  
  const getPricePerShare = (holding: Holding) => {
    return holding.shares > 0 ? holding.value / holding.shares : 0;
  };
  
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onClose}
            className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              {accountName} Portfolio
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Total Portfolio Value: {formatCurrency(totalValue, currency)}
            </p>
          </div>
        </div>
        
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => navigate(`/transactions?account=${accountId}`)}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            View Transactions
          </button>
        </div>
      </div>
      
      {/* Portfolio Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Holdings</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{holdings.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Portfolio Value</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(totalValue, currency)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Largest Position</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {sortedHoldings[0]?.name || 'N/A'}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {sortedHoldings[0] ? `${getPercentage(sortedHoldings[0].value)}%` : ''}
          </p>
        </div>
      </div>
      
      {/* Holdings Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Holdings</h2>
        </div>
        
        {holdings.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              No holdings in this portfolio yet.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-300 mt-2">
              Add holdings to track your investments.
            </p>
          </div>
        ) : (
        <>
        
        {/* Sort Options */}
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">Sort by:</span>
            <button
              onClick={() => setSortBy('value')}
              className={`text-sm px-3 py-1 rounded ${
                sortBy === 'value' 
                  ? 'bg-primary text-white' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Value
            </button>
            <button
              onClick={() => setSortBy('shares')}
              className={`text-sm px-3 py-1 rounded ${
                sortBy === 'shares' 
                  ? 'bg-primary text-white' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Shares
            </button>
            <button
              onClick={() => setSortBy('name')}
              className={`text-sm px-3 py-1 rounded ${
                sortBy === 'name' 
                  ? 'bg-primary text-white' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Name
            </button>
          </div>
        </div>
        
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700">
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Ticker
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Shares/Units
                </th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Price per Share
                </th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Value
                </th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  % of Portfolio
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {sortedHoldings.map((holding, index) => (
                <tr key={`${holding.ticker}-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {holding.ticker}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {holding.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                    {holding.shares.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                    {formatCurrency(getPricePerShare(holding), currency)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900 dark:text-white">
                    {formatCurrency(holding.value, currency)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-20 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${getPercentage(holding.value)}%` }}
                        />
                      </div>
                      <span className="text-gray-600 dark:text-gray-400 w-12 text-right">
                        {getPercentage(holding.value)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Mobile Card View */}
        <div className="md:hidden">
          {sortedHoldings.map((holding, index) => (
            <div 
              key={`${holding.ticker}-${index}`}
              className="px-4 py-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{holding.ticker}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{holding.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(holding.value, currency)}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {getPercentage(holding.value)}%
                  </p>
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {holding.shares.toLocaleString()} shares
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  @ {formatCurrency(getPricePerShare(holding), currency)}
                </span>
              </div>
            </div>
          ))}
        </div>
        </>
        )}
      </div>
    </div>
  );
}