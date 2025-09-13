import React, { useEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '../../icons';
import { logger } from '../../../services/loggingService';

interface TransactionPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  itemsPerPage: number;
  showAllTransactions: boolean;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (value: number) => void;
}

export function TransactionPagination({
  currentPage,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  itemsPerPage,
  showAllTransactions,
  onPageChange,
  onItemsPerPageChange
}: TransactionPaginationProps): React.JSX.Element | null {
  if (totalPages <= 1 && !showAllTransactions) return null;

  const renderPageNumbers = () => {
    const pages = [];
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);
    
    if (currentPage <= 3) {
      startPage = 1;
      endPage = Math.min(5, totalPages);
    } else if (currentPage >= totalPages - 2) {
      startPage = Math.max(1, totalPages - 4);
      endPage = totalPages;
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => onPageChange(i)}
          disabled={i === currentPage}
          className={`hidden sm:inline-flex px-3 py-1 text-sm rounded-lg transition-colors ${
            i === currentPage
              ? 'bg-primary text-white cursor-default'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          {i}
        </button>
      );
    }
    
    return pages;
  };

  return (
    <div>
      <div className="hidden lg:block px-6 py-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {showAllTransactions 
                ? `Showing all ${totalItems} transactions`
                : `Showing ${startIndex + 1} to ${Math.min(endIndex, totalItems)} of ${totalItems} transactions`
              }
            </span>
            <label htmlFor="per-page-desktop" className="sr-only">Items per page</label>
            <select
              id="per-page-desktop"
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="ml-2 px-2 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:text-white"
              disabled={showAllTransactions}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          
          {!showAllTransactions && (
            <div className="flex items-center gap-1">
              {/* Previous Button */}
              <button
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeftIcon size={20} />
              </button>
              
              {/* Page Numbers */}
              <div className="flex gap-1 px-2">
                {currentPage > 3 && totalPages > 5 && (
                  <>
                    <button
                      onClick={() => onPageChange(1)}
                      className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      1
                    </button>
                    {currentPage > 4 && (
                      <span className="px-2 py-1 text-gray-500 dark:text-gray-400">...</span>
                    )}
                  </>
                )}
                
                {renderPageNumbers()}
                
                {currentPage < totalPages - 2 && totalPages > 5 && (
                  <>
                    {currentPage < totalPages - 3 && (
                      <span className="px-2 py-1 text-gray-500 dark:text-gray-400">...</span>
                    )}
                    <button
                      onClick={() => onPageChange(totalPages)}
                      className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      {totalPages}
                    </button>
                  </>
                )}
              </div>
              
              {/* Next Button */}
              <button
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                <ChevronRightIcon size={20} />
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Mobile Pagination - Simplified */}
      <div className="lg:hidden px-4 py-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1 || showAllTransactions}
            className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Page {currentPage} of {totalPages}
          </span>
          
          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages || showAllTransactions}
            className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}