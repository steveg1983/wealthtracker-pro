import React from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { LightbulbIcon, CheckIcon } from './icons';
import type { Transaction } from '../types';

interface CategorySuggestionProps {
  transaction: Transaction;
  suggestions: {
    categoryId: string;
    confidence: number;
    reason: string;
  }[];
  onAccept: (categoryId: string) => void;
}

export default function CategorySuggestion({ 
  transaction, 
  suggestions, 
  onAccept 
}: CategorySuggestionProps) {
  const { categories } = useApp();

  if (suggestions.length === 0 || transaction.category) {
    return null;
  }

  const topSuggestion = suggestions.at(0);
  if (!topSuggestion) {
    return null;
  }
  const category = categories.find(c => c.id === topSuggestion.categoryId);

  if (!category) {
    return null;
  }

  const confidencePercent = Math.round(topSuggestion.confidence * 100);
  const confidenceColor = 
    confidencePercent >= 80 ? 'text-green-600 dark:text-green-400' :
    confidencePercent >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
    'text-gray-600 dark:text-gray-400';

  return (
    <div className="flex items-center gap-2 mt-1">
      <LightbulbIcon size={14} className="text-yellow-500" />
      <span className="text-xs text-gray-600 dark:text-gray-400">
        Suggested:
      </span>
      <button
        onClick={() => onAccept(topSuggestion.categoryId)}
        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        title={topSuggestion.reason}
      >
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: category.color }}
        />
        <span className="font-medium">{category.name}</span>
        <span className={`${confidenceColor} font-semibold`}>
          {confidencePercent}%
        </span>
        <CheckIcon size={12} className="text-gray-500" />
      </button>
      {suggestions.length > 1 && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          +{suggestions.length - 1} more
        </span>
      )}
    </div>
  );
}
