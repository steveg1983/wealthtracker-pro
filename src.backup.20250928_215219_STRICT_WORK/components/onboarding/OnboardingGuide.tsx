import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  XMarkIcon, 
  BanknotesIcon, 
  DocumentArrowUpIcon,
  ChartBarIcon,
  CheckCircleIcon 
} from '@heroicons/react/24/outline';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  iconName: 'banknotes' | 'upload' | 'chart';
  action: string;
  actionLabel: string;
  path?: string;
}

const onboardingSteps: OnboardingStep[] = [
  {
    id: 'connect',
    title: 'Connect your accounts',
    description: 'Use feeds to get your full financial picture with your bank accounts, credit cards, investments and more in one place automatically.',
    iconName: 'banknotes',
    action: 'connect',
    actionLabel: 'START HERE',
    path: '/settings/bank-connections'
  },
  {
    id: 'upload',
    title: 'Upload your data',
    description: 'Upload files from your bank, or move your data from other apps like Money Dashboard, YNAB, Mint, Quicken and more.',
    iconName: 'upload',
    action: 'upload',
    actionLabel: 'START HERE',
    path: '/import'
  },
  {
    id: 'guided',
    title: 'Take guided mode',
    description: 'Start here if you are new to personal finance software or looking for guides to set up your expenses and income categories.',
    iconName: 'chart',
    action: 'guided',
    actionLabel: 'START HERE',
    path: '/dashboard'
  }
];

interface OnboardingGuideProps {
  onComplete: () => void;
}

export default function OnboardingGuide({ onComplete }: OnboardingGuideProps): React.JSX.Element {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [showMainOptions, setShowMainOptions] = useState(true);

  const renderIcon = (iconName: OnboardingStep['iconName']) => {
    switch (iconName) {
      case 'banknotes':
        return <BanknotesIcon className="w-12 h-12 text-gray-600" />;
      case 'upload':
        return <DocumentArrowUpIcon className="w-12 h-12 text-green-600" />;
      case 'chart':
        return <ChartBarIcon className="w-12 h-12 text-purple-600" />;
      default:
        return <CheckCircleIcon className="w-12 h-12 text-gray-600" />;
    }
  };

  const handleStepAction = (step: OnboardingStep) => {
    if (step.path) {
      navigate(step.path);
    }
    onComplete();
  };

  const handleDemoMode = () => {
    navigate('/dashboard?demo=true');
    onComplete();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 p-8 pb-12">
          <button
            onClick={onComplete}
            className="absolute top-4 right-4 p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
          
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white dark:bg-gray-800 rounded-full shadow-lg mb-4">
              <span className="text-2xl font-bold bg-gradient-to-r from-gray-600 to-purple-600 bg-clip-text text-transparent">
                W
              </span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Let's get started!
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Begin your financial journey at your own pace.
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {showMainOptions ? (
            <>
              {/* Main Options */}
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                {onboardingSteps.map((step) => (
                  <div
                    key={step.id}
                    className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer"
                    onClick={() => handleStepAction(step)}
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="mb-4">{renderIcon(step.iconName)}</div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {step.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        {step.description}
                      </p>
                      <button className="px-4 py-2 bg-gradient-to-r from-gray-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-colors">
                        {step.actionLabel}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Demo Mode Option */}
              <div className="text-center pt-6 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Turn on demo mode to see sample data on WealthTracker.
                </p>
                <button
                  onClick={handleDemoMode}
                  className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  DEMO MODE
                </button>
              </div>
            </>
          ) : (
            /* Step-by-step guidance would go here */
            <div className="text-center py-12">
              <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Great choice!
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Let's get you set up...
              </p>
            </div>
          )}
        </div>

        {/* Progress Steps */}
        <div className="bg-blue-50 dark:bg-gray-900 px-8 py-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-gray-600 text-white flex items-center justify-center text-sm font-medium">
                1
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Get started</span>
            </div>
            <div className="w-12 h-px bg-gray-300 dark:bg-gray-600"></div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 flex items-center justify-center text-sm font-medium">
                2
              </div>
              <span className="text-sm text-gray-400 dark:text-gray-500">Know your spending</span>
            </div>
            <div className="w-12 h-px bg-gray-300 dark:bg-gray-600"></div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 flex items-center justify-center text-sm font-medium">
                3
              </div>
              <span className="text-sm text-gray-400 dark:text-gray-500">Plan your finances</span>
            </div>
            <div className="w-12 h-px bg-gray-300 dark:bg-gray-600"></div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 flex items-center justify-center text-sm font-medium">
                4
              </div>
              <span className="text-sm text-gray-400 dark:text-gray-500">Gain insights</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
