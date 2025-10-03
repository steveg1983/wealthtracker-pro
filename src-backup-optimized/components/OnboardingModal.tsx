/**
 * OnboardingModal Component - Welcome and onboarding flow
 *
 * Features:
 * - Welcome message for new users
 * - Quick start guide
 * - Feature highlights
 * - Setup steps
 */

import React, { useState } from 'react';
import Modal from './common/Modal';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

interface OnboardingStep {
  title: string;
  description: string;
  icon: string;
  action?: string;
}

const onboardingSteps: OnboardingStep[] = [
  {
    title: 'Welcome to WealthTracker!',
    description: 'Take control of your finances with our comprehensive personal finance management platform.',
    icon: '👋',
  },
  {
    title: 'Add Your Accounts',
    description: 'Connect your bank accounts or add them manually to get a complete picture of your finances.',
    icon: '🏦',
    action: 'Add Account'
  },
  {
    title: 'Track Transactions',
    description: 'Monitor your income and expenses. Categorize transactions to understand your spending patterns.',
    icon: '💰',
    action: 'Add Transaction'
  },
  {
    title: 'Create Budgets',
    description: 'Set spending limits by category to stay on track with your financial goals.',
    icon: '📊',
    action: 'Create Budget'
  },
  {
    title: 'Set Financial Goals',
    description: 'Define your savings targets and track your progress towards achieving them.',
    icon: '🎯',
    action: 'Set Goal'
  }
];

export default function OnboardingModal({
  isOpen,
  onClose,
  onComplete
}: OnboardingModalProps): React.JSX.Element {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    onComplete();
    onClose();
  };

  const handleSkip = () => {
    onClose();
  };

  const currentStepData = onboardingSteps[currentStep];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleSkip}
      size="lg"
      closeOnBackdrop={false}
      showCloseButton={false}
    >
      <div className="space-y-6">
        {/* Progress indicator */}
        <div className="flex items-center justify-between">
          <div className="flex space-x-2">
            {onboardingSteps.map((_, index) => (
              <div
                key={index}
                className={`w-3 h-3 rounded-full transition-colors duration-200 ${
                  index <= currentStep
                    ? 'bg-blue-600'
                    : 'bg-gray-200 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {currentStep + 1} of {onboardingSteps.length}
          </span>
        </div>

        {/* Step content */}
        <div className="text-center space-y-4">
          <div className="text-6xl">{currentStepData.icon}</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {currentStepData.title}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            {currentStepData.description}
          </p>

          {currentStepData.action && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Quick Action:</strong> Use the "{currentStepData.action}" button to get started with this feature.
              </p>
            </div>
          )}
        </div>

        {/* Features highlight for welcome step */}
        {currentStep === 0 && (
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl mb-2">🔒</div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Secure</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Bank-level security</div>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl mb-2">📱</div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Mobile Ready</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Works on all devices</div>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl mb-2">📊</div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Analytics</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Detailed insights</div>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl mb-2">🎯</div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Goal Tracking</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Achieve your targets</div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between items-center pt-4">
          <button
            type="button"
            className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-200"
            onClick={handleSkip}
          >
            Skip Tour
          </button>

          <div className="flex space-x-3">
            {currentStep > 0 && (
              <button
                type="button"
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors duration-200"
                onClick={handlePrevious}
              >
                Previous
              </button>
            )}
            <button
              type="button"
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 font-medium"
              onClick={handleNext}
            >
              {currentStep === onboardingSteps.length - 1 ? 'Get Started!' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}