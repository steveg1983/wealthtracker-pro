import React, { useEffect } from 'react';
import { Modal } from './common/Modal';
import type { Goal } from '../types';
import { CheckCircleIcon } from './icons';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';

interface GoalCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: Goal;
  message: string;
}

export default function GoalCelebrationModal({ isOpen, onClose, goal, message }: GoalCelebrationModalProps): React.JSX.Element {
  const { formatCurrency } = useCurrencyDecimal();

  useEffect(() => {
    if (isOpen) {
      // Auto-close after 5 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  const getGoalIcon = (type: Goal['type']): string => {
    switch (type) {
      case 'savings':
        return '💰';
      case 'debt-payoff':
        return '💳';
      case 'investment':
        return '📈';
      case 'custom':
        return '🎯';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="sm"
    >
      <div className="text-center py-6">
        {/* Trophy Animation */}
        <div className="relative inline-block mb-6">
          <div className="animate-bounce">
            <span className="text-6xl">🏆</span>
          </div>
          <div className="absolute -top-2 -right-2 animate-pulse">
            <CheckCircleIcon size={32} className="text-green-500" />
          </div>
        </div>

        {/* Goal Icon and Name */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <span className="text-4xl">{getGoalIcon(goal.type)}</span>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {goal.name}
          </h2>
        </div>

        {/* Celebration Message */}
        <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
          {message}
        </p>

        {/* Achievement Details */}
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 mb-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Target Achieved
          </p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(goal.targetAmount)}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => {
              onClose();
              // Share functionality could be added here
            }}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <span>Share Achievement</span>
            <span>🎉</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}