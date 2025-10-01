import { useMemo } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import type { Account, Transaction, Budget, Goal } from '../types';
import { logger } from '../services/loggingService';

export interface SearchResult {
  id: string;
  type: 'account' | 'transaction' | 'budget' | 'goal' | 'category';
  title: string;
  description: string;
  data: Account | Transaction | Budget | Goal | { id: string; name: string };
  score: number;
  matches: string[];
  icon?: React.ComponentType<any>;
}

export function useGlobalSearch(query: string): {
  results: SearchResult[];
  hasResults: boolean;
  resultCount: number;
} {
  const { accounts, transactions, budgets, goals, categories } = useApp();

  const searchResults = useMemo(() => {
    if (!query || query.length < 2) {
      return [];
    }

    const results: SearchResult[] = [];
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);

    const toSearchableText = (value: unknown): string => {
      if (typeof value === 'string') {
        return value;
      }
      if (value === undefined || value === null) {
        return '';
      }
      return String(value);
    };

    try {

    // Helper function to calculate search score
    const calculateScore = (rawText: string, terms: string[]): { score: number; matches: string[] } => {
      const lowerText = rawText.toLowerCase();
      let score = 0;
      const matches: string[] = [];

      terms.forEach(term => {
        if (lowerText.includes(term)) {
          // Exact match gets higher score
          if (lowerText === term) {
            score += 100;
          } else if (lowerText.startsWith(term)) {
            score += 50;
          } else {
            score += 20;
          }
          matches.push(term);
        }
      });

      return { score, matches };
    };

    // Helper function to get category name
    const getCategoryName = (categoryId: string | undefined): string => {
      if (!categoryId) return '';
      const category = categories.find(cat => cat.id === categoryId);
      return category?.name || '';
    };

    // Search accounts
    accounts.forEach(account => {
      try {
        const titleScore = calculateScore(toSearchableText(account.name), searchTerms);
        const institutionScore = calculateScore(toSearchableText(account.institution), searchTerms);
        const typeScore = calculateScore(toSearchableText(account.type), searchTerms);
        
        const totalScore = titleScore.score + institutionScore.score + typeScore.score;
        const allMatches = [...titleScore.matches, ...institutionScore.matches, ...typeScore.matches];

        if (totalScore > 0) {
          const balance = typeof account.balance === 'number' ? account.balance.toFixed(2) : '0.00';
          results.push({
            id: account.id,
            type: 'account',
            title: account.name,
            description: `${account.type} at ${account.institution || 'Unknown'} - ${account.currency || 'GBP'} ${balance}`,
            data: account,
            score: totalScore,
            matches: [...new Set(allMatches)],
          });
        }
      } catch (error) {
        logger.error('Error searching account', { accountId: account.id, error }, 'useGlobalSearch');
      }
    });

    // Search transactions
    transactions.forEach(transaction => {
      try {
        const descriptionScore = calculateScore(toSearchableText(transaction.description), searchTerms);
        const categoryScore = calculateScore(getCategoryName(transaction.category), searchTerms);
        const amountScore = calculateScore(toSearchableText(transaction.amount), searchTerms);
        const typeScore = calculateScore(toSearchableText(transaction.type), searchTerms);
        
        const totalScore = descriptionScore.score + categoryScore.score + amountScore.score + typeScore.score;
        const allMatches = [...descriptionScore.matches, ...categoryScore.matches, ...amountScore.matches, ...typeScore.matches];

        if (totalScore > 0) {
          const account = accounts.find(acc => acc.id === transaction.accountId);
          const amountValue = typeof transaction.amount === 'number' ? transaction.amount : Number(transaction.amount);
          const amount = Number.isFinite(amountValue) ? amountValue.toFixed(2) : '0.00';
          results.push({
            id: transaction.id,
            type: 'transaction',
            title: transaction.description,
            description: `${transaction.type} - ${amount} ${account?.currency || 'GBP'} (${getCategoryName(transaction.category)})`,
            data: transaction,
            score: totalScore,
            matches: [...new Set(allMatches)],
          });
        }
      } catch (error) {
        logger.error('Error searching transaction', { transactionId: transaction.id, error }, 'useGlobalSearch');
      }
    });

    // Search budgets
    budgets.forEach(budget => {
      try {
        const categoryScore = calculateScore(getCategoryName(budget.categoryId), searchTerms);
        const amountScore = calculateScore(toSearchableText(budget.amount), searchTerms);
        const periodScore = calculateScore(toSearchableText(budget.period), searchTerms);
        
        const totalScore = categoryScore.score + amountScore.score + periodScore.score;
        const allMatches = [...categoryScore.matches, ...amountScore.matches, ...periodScore.matches];

        if (totalScore > 0) {
          const amountValue = typeof budget.amount === 'number' ? budget.amount : Number(budget.amount);
          const amount = Number.isFinite(amountValue) ? amountValue.toFixed(2) : '0.00';
          results.push({
            id: budget.id,
            type: 'budget',
            title: `${getCategoryName(budget.categoryId)} Budget`,
            description: `${budget.period} budget - ${amount} GBP`,
            data: budget,
            score: totalScore,
            matches: [...new Set(allMatches)],
          });
        }
      } catch (error) {
        logger.error('Error searching budget', { budgetId: budget.id, error }, 'useGlobalSearch');
      }
    });

    // Search goals
    goals.forEach(goal => {
      try {
        const nameScore = calculateScore(toSearchableText(goal.name), searchTerms);
        const typeScore = calculateScore(toSearchableText(goal.type), searchTerms);
        const targetScore = calculateScore(toSearchableText(goal.targetAmount), searchTerms);
        const currentScore = calculateScore(toSearchableText(goal.currentAmount), searchTerms);
        
        const totalScore = nameScore.score + typeScore.score + targetScore.score + currentScore.score;
        const allMatches = [...nameScore.matches, ...typeScore.matches, ...targetScore.matches, ...currentScore.matches];

        if (totalScore > 0) {
          const currentAmount = typeof goal.currentAmount === 'number' ? goal.currentAmount : Number(goal.currentAmount);
          const targetAmount = typeof goal.targetAmount === 'number' ? goal.targetAmount : Number(goal.targetAmount);
          const progress = targetAmount > 0 ? ((currentAmount / targetAmount) * 100).toFixed(1) : '0.0';
          
          results.push({
            id: goal.id,
            type: 'goal',
            title: goal.name,
            description: `${goal.type} goal - ${currentAmount.toFixed(2)} / ${targetAmount.toFixed(2)} GBP (${progress}%)`,
            data: goal,
            score: totalScore,
            matches: [...new Set(allMatches)],
          });
        }
      } catch (error) {
        logger.error('Error searching goal', { goalId: goal.id, error }, 'useGlobalSearch');
      }
    });

    // Sort by score (highest first)
    return results.sort((a, b) => b.score - a.score);
    } catch (error) {
      logger.error('Error in global search', error, 'useGlobalSearch');
      return [];
    }
  }, [query, accounts, transactions, budgets, goals, categories]);

  return {
    results: searchResults,
    hasResults: searchResults.length > 0,
    resultCount: searchResults.length,
  };
}
