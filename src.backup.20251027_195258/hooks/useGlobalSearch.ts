import { useMemo } from 'react';
import type { ComponentType } from 'react';
import { Decimal, formatPercentageValue } from '@wealthtracker/utils';
import { useApp } from '../contexts/AppContextSupabase';
import type { Account, Transaction, Budget, Goal } from '../types';
import { lazyLogger } from '../services/serviceFactory';
import { formatCurrency, parseCurrencyDecimal } from '../utils/currency-decimal';

const logger = lazyLogger.getLogger('UseGlobalSearch');

export interface SearchResult {
  id: string;
  type: 'account' | 'transaction' | 'budget' | 'goal' | 'category';
  title: string;
  description: string;
  data: Account | Transaction | Budget | Goal | { id: string; name: string };
  score: number;
  matches: string[];
  icon?: ComponentType<{ className?: string; size?: number }>;
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
      if (typeof value === 'number') {
        return Number.isFinite(value) ? value.toString() : '';
      }
      if (value === undefined || value === null) {
        return '';
      }
      if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      return String(value);
    };

    try {
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
          const balanceDecimal = parseCurrencyDecimal(account.balance);
          const formattedBalance = formatCurrency(balanceDecimal, account.currency || 'GBP');
          results.push({
            id: account.id,
            type: 'account',
            title: account.name,
            description: `${account.type} at ${account.institution || 'Unknown'} - ${formattedBalance}`,
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
        const amountDecimal = parseCurrencyDecimal(transaction.amount);
        const amountScore = calculateScore(amountDecimal.toString(), searchTerms);
        const typeScore = calculateScore(toSearchableText(transaction.type), searchTerms);
        
        const totalScore = descriptionScore.score + categoryScore.score + amountScore.score + typeScore.score;
        const allMatches = [...descriptionScore.matches, ...categoryScore.matches, ...amountScore.matches, ...typeScore.matches];

        if (totalScore > 0) {
          const account = accounts.find(acc => acc.id === transaction.accountId);
          const formattedAmount = formatCurrency(amountDecimal, account?.currency || 'GBP');
          results.push({
            id: transaction.id,
            type: 'transaction',
            title: transaction.description,
            description: `${transaction.type} - ${formattedAmount} (${getCategoryName(transaction.category)})`,
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
        const amountDecimal = parseCurrencyDecimal(budget.amount);
        const amountScore = calculateScore(amountDecimal.toString(), searchTerms);
        const periodScore = calculateScore(toSearchableText(budget.period), searchTerms);
        
        const totalScore = categoryScore.score + amountScore.score + periodScore.score;
        const allMatches = [...categoryScore.matches, ...amountScore.matches, ...periodScore.matches];

        if (totalScore > 0) {
          const formattedAmount = formatCurrency(amountDecimal, 'GBP');
          results.push({
            id: budget.id,
            type: 'budget',
            title: `${getCategoryName(budget.categoryId)} Budget`,
            description: `${budget.period} budget - ${formattedAmount}`,
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
        const targetAmountDecimal = parseCurrencyDecimal(goal.targetAmount);
        const currentAmountDecimal = parseCurrencyDecimal(goal.currentAmount);
        const targetScore = calculateScore(targetAmountDecimal.toString(), searchTerms);
        const currentScore = calculateScore(currentAmountDecimal.toString(), searchTerms);
        
        const totalScore = nameScore.score + typeScore.score + targetScore.score + currentScore.score;
        const allMatches = [...nameScore.matches, ...typeScore.matches, ...targetScore.matches, ...currentScore.matches];

        if (totalScore > 0) {
          const progressDecimal = targetAmountDecimal.isZero()
            ? new Decimal(0)
            : currentAmountDecimal.dividedBy(targetAmountDecimal).times(100);
          const progress = formatPercentageValue(progressDecimal, 1);
          
          results.push({
            id: goal.id,
            type: 'goal',
            title: goal.name,
            description: `${goal.type} goal - ${formatCurrency(currentAmountDecimal, 'GBP')} / ${formatCurrency(targetAmountDecimal, 'GBP')} (${progress})`,
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
