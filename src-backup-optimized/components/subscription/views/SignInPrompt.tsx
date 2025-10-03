/**
 * Sign In Prompt Component
 * Shows when user is not authenticated
 */

import React, { useEffect } from 'react';
import { useLogger } from '../services/ServiceProvider';

interface SignInPromptProps {
  onSignIn: () => void;
}

const SignInPrompt = React.memo(({ onSignIn }: SignInPromptProps) => {
  return (
    <div className="text-center py-12">
      <div className="max-w-md mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Sign In Required
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Please sign in to manage your subscription and access premium features.
        </p>
        <button
          onClick={onSignIn}
          className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Sign In
        </button>
      </div>
    </div>
  );
});

SignInPrompt.displayName = 'SignInPrompt';

export default SignInPrompt;