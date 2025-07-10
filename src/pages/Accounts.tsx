import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import AddAccountModal from '../components/AddAccountModal';
import AddTransactionModal from '../components/AddTransactionModal';
import { Edit2, Trash2, TrendingUp, TrendingDown, Plus } from 'lucide-react';

export default function Accounts() {
  const { accounts, deleteAccount } = useApp();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  const formatCurrency = (amount: number, currency: string) => {
    const symbols: { [key: string]: string } = {
      GBP: '£',
      USD: '$',
      EUR: '€',
    };
    return `${symbols[currency] || currency}${Math.abs(amount).toFixed(2)}`;
  };

  const getAccountTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      checking: 'bg-blue-100 text-blue-800',
      savings: 'bg-green-100 text-green-800',
      credit: 'bg-red-100 text-red-800',
      investment: 'bg-purple-100 text-purple-800',
      loan: 'bg-orange-100 text-orange-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return colors[type] || colors.other;
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this account?')) {
      deleteAccount(id);
    }
  };

  const handleAddTransaction = (accountId: string) => {
    setSelectedAccountId(accountId);
    setIsTransactionModalOpen(true);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Accounts</h1>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary transition-colors"
        >
          Add Account
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">
            No accounts added yet. Click "Add Account" to get started!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account) => (
            <div key={account.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{account.name}</h3>
                  {account.institution && (
                    <p className="text-sm text-gray-500">{account.institution}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => handleAddTransaction(account.id)}
                    className="p-1 hover:bg-gray-100 rounded text-primary"
                    title="Add transaction"
                  >
                    <Plus size={16} />
                  </button>
                  <button className="p-1 hover:bg-gray-100 rounded">
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(account.id)}
                    className="p-1 hover:bg-gray-100 rounded text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getAccountTypeColor(account.type)}`}>
                  {account.type.charAt(0).toUpperCase() + account.type.slice(1)}
                </span>

                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">
                    {formatCurrency(account.balance, account.currency)}
                  </span>
                  {account.balance > 0 ? (
                    <TrendingUp className="text-green-500" size={20} />
                  ) : account.balance < 0 ? (
                    <TrendingDown className="text-red-500" size={20} />
                  ) : null}
                </div>

                <p className="text-xs text-gray-500">
                  Updated: {new Date(account.lastUpdated).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddAccountModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
      />
      
      <AddTransactionModal 
        isOpen={isTransactionModalOpen} 
        onClose={() => {
          setIsTransactionModalOpen(false);
          setSelectedAccountId('');
        }}
        preSelectedAccountId={selectedAccountId}
      />
    </div>
  );
}
