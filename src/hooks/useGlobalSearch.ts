import { useMemo } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import type { Account, Transaction, Budget, Goal } from '../types';
import { formatCurrency } from '../utils/currency-decimal';
import { Decimal, toDecimal } from '../utils/decimal';
import { formatDecimal } from '../utils/decimal-format';

export interface SearchResult {
  id: string;
  type: 'account' | 'transaction' | 'budget' | 'goal' | 'category';
  title: string;
  description: string;
  data: Account | Transaction | Budget | Goal | { id: string; name: string };
  score: number;
  matches: string[];
  icon?: React.ComponentType<Record<string, unknown>>;
}

type Logger = Pick<Console, 'error'>;
const searchLogger: Logger = typeof console !== 'undefined' ? console : { error: () => {} };

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

    try {

    // Helper function to calculate search score
    const calculateScore = (text: string, terms: string[]): { score: number; matches: string[] } => {
      const lowerText = text.toLowerCase();
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
        const titleScore = calculateScore(account.name, searchTerms);
        const institutionScore = calculateScore(account.institution || '', searchTerms);
        const typeScore = calculateScore(account.type, searchTerms);
        
        const totalScore = titleScore.score + institutionScore.score + typeScore.score;
        const allMatches = [...titleScore.matches, ...institutionScore.matches, ...typeScore.matches];

        if (totalScore > 0) {
          const balanceDecimal = toDecimal(account.balance ?? 0);
          const balance = formatCurrency(balanceDecimal, account.currency || 'GBP');
          results.push({
            id: account.id,
            type: 'account',
            title: account.name,
            description: `${account.type} at ${account.institution || 'Unknown'} - ${balance}`,
            data: account,
            score: totalScore,
            matches: [...new Set(allMatches)],
          });
        }
      } catch (error) {
        searchLogger.error('Error searching account:', account.id, error as Error);
      }
    });

    // Search transactions
    transactions.forEach(transaction => {
      try {
        const descriptionScore = calculateScore(transaction.description, searchTerms);
        const categoryScore = calculateScore(getCategoryName(transaction.category), searchTerms);
        const amountScore = calculateScore(transaction.amount?.toString() || '', searchTerms);
        const typeScore = calculateScore(transaction.type, searchTerms);
        
        const totalScore = descriptionScore.score + categoryScore.score + amountScore.score + typeScore.score;
        const allMatches = [...descriptionScore.matches, ...categoryScore.matches, ...amountScore.matches, ...typeScore.matches];

        if (totalScore > 0) {
          const account = accounts.find(acc => acc.id === transaction.accountId);
          const amountFormatted = formatCurrency(transaction.amount ?? 0, account?.currency || 'GBP');
          results.push({
            id: transaction.id,
            type: 'transaction',
            title: transaction.description,
            description: `${transaction.type} - ${amountFormatted} (${getCategoryName(transaction.category)})`,
            data: transaction,
            score: totalScore,
            matches: [...new Set(allMatches)],
          });
        }
      } catch (error) {
        searchLogger.error('Error searching transaction:', transaction.id, error as Error);
      }
    });

    // Search budgets
    budgets.forEach(budget => {
      try {
        const categoryScore = calculateScore(getCategoryName(budget.categoryId), searchTerms);
        const amountScore = calculateScore(budget.amount?.toString() || '', searchTerms);
        const periodScore = calculateScore(budget.period, searchTerms);
        
        const totalScore = categoryScore.score + amountScore.score + periodScore.score;
        const allMatches = [...categoryScore.matches, ...amountScore.matches, ...periodScore.matches];

        if (totalScore > 0) {
          const amountFormatted = formatCurrency(budget.amount ?? 0, 'GBP');
          results.push({
            id: budget.id,
            type: 'budget',
            title: `${getCategoryName(budget.categoryId)} Budget`,
            description: `${budget.period} budget - ${amountFormatted}`,
            data: budget,
            score: totalScore,
            matches: [...new Set(allMatches)],
          });
        }
      } catch (error) {
        searchLogger.error('Error searching budget:', budget.id, error as Error);
      }
    });

    // Search goals
    goals.forEach(goal => {
      try {
        const nameScore = calculateScore(goal.name, searchTerms);
        const typeScore = calculateScore(goal.type, searchTerms);
        const targetScore = calculateScore(goal.targetAmount?.toString() || '', searchTerms);
        const currentScore = calculateScore(goal.currentAmount?.toString() || '', searchTerms);
        
        const totalScore = nameScore.score + typeScore.score + targetScore.score + currentScore.score;
        const allMatches = [...nameScore.matches, ...typeScore.matches, ...targetScore.matches, ...currentScore.matches];

        if (totalScore > 0) {
          const currentAmountDecimal = toDecimal(goal.currentAmount ?? 0);
          const targetAmountDecimal = toDecimal(goal.targetAmount ?? 0);
          const progressDecimal = targetAmountDecimal.equals(0)
            ? new Decimal(0)
            : currentAmountDecimal.dividedBy(targetAmountDecimal).times(100);
          const progressDisplay = formatDecimal(progressDecimal, 1);
          
          results.push({
            id: goal.id,
            type: 'goal',
            title: goal.name,
            description: `${goal.type} goal - ${formatCurrency(currentAmountDecimal, 'GBP')} / ${formatCurrency(targetAmountDecimal, 'GBP')} (${progressDisplay}%)`,
            data: goal,
            score: totalScore,
            matches: [...new Set(allMatches)],
          });
        }
      } catch (error) {
        searchLogger.error('Error searching goal:', goal.id, error as Error);
      }
    });

    // Sort by score (highest first)
    return results.sort((a, b) => b.score - a.score);
    } catch (error) {
      searchLogger.error('Error in global search:', error as Error);
      return [];
    }
  }, [query, accounts, transactions, budgets, goals, categories]);

  return {
    results: searchResults,
    hasResults: searchResults.length > 0,
    resultCount: searchResults.length,
  };
}
