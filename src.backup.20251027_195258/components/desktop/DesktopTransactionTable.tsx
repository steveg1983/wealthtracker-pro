import React from 'react';
import type { Transaction } from '../../types';

interface DesktopTransactionTableProps {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  _onBulkSelect: (ids: string[]) => void;
}

/**
 * Desktop-optimized transaction table with full features
 * - Bulk selection
 * - Advanced filtering
 * - Column sorting
 * - Inline editing
 * - Export capabilities
 */
export const DesktopTransactionTable: React.FC<DesktopTransactionTableProps> = ({
  transactions,
  onEdit,
  onDelete,
  _onBulkSelect
}) => {
  // This is a placeholder showing the structure
  // Actual implementation would include full DataGrid features
  
  return (
    <div className="desktop-transaction-table">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-2xl font-bold">Transactions</h2>
        <div className="flex gap-2">
          <button className="btn-primary">Bulk Edit</button>
          <button className="btn-secondary">Export</button>
          <button className="btn-secondary">Advanced Filter</button>
        </div>
      </div>
      
      {/* Full-featured data table would go here */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">
                <input type="checkbox" className="rounded text-slate-500 focus:ring-slate-400 accent-slate-500 flex-shrink-0" />
              </th>
              <th className="px-6 py-3 text-left">Date</th>
              <th className="px-6 py-3 text-left">Description</th>
              <th className="px-6 py-3 text-left">Category</th>
              <th className="px-6 py-3 text-right">Amount</th>
              <th className="px-6 py-3 text-left">Account</th>
              <th className="px-6 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(transaction => (
              <tr key={transaction.id} className="border-t hover:bg-gray-50">
                <td className="px-6 py-4">
                  <input type="checkbox" className="rounded text-slate-500 focus:ring-slate-400 accent-slate-500 flex-shrink-0" />
                </td>
                <td className="px-6 py-4">{new Date(transaction.date).toLocaleDateString()}</td>
                <td className="px-6 py-4">{transaction.description}</td>
                <td className="px-6 py-4">{transaction.category}</td>
                <td className="px-6 py-4 text-right font-mono">
                  {transaction.amount}
                </td>
                <td className="px-6 py-4">{transaction.accountId}</td>
                <td className="px-6 py-4 text-center">
                  <button onClick={() => onEdit(transaction)} className="text-gray-600 hover:text-blue-800 mr-2">
                    Edit
                  </button>
                  <button onClick={() => onDelete(transaction.id)} className="text-red-600 hover:text-red-800">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};