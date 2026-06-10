import { useEffect, useRef } from 'react';
import { EditIcon, DeleteIcon, CreditCardIcon } from './icons';
import type { Transaction } from '../types';

interface TransactionContextMenuProps {
  x: number;
  y: number;
  transaction: Transaction;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onView?: (transaction: Transaction) => void;
  onClose: () => void;
}

export default function TransactionContextMenu({
  x,
  y,
  transaction,
  onEdit,
  onDelete,
  onView,
  onClose,
}: TransactionContextMenuProps): React.JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to keep menu on screen
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - 180);

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[180px]"
      style={{ left: adjustedX, top: adjustedY }}
      role="menu"
      aria-label="Transaction actions"
    >
      {onView && (
        <button
          onClick={() => { onView(transaction); onClose(); }}
          role="menuitem" className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
        >
          <CreditCardIcon size={16} className="text-gray-400" />
          View Details
        </button>
      )}
      <button
        onClick={() => { onEdit(transaction); onClose(); }}
        role="menuitem" className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
      >
        <EditIcon size={16} className="text-gray-400" />
        Edit Transaction
      </button>
      <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
      <button
        onClick={() => { onDelete(transaction.id); onClose(); }}
        role="menuitem" className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
      >
        <DeleteIcon size={16} />
        Delete Transaction
      </button>
    </div>
  );
}
