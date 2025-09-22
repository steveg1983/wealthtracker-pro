/**
 * Verification Header Component
 * World-class header with enterprise-grade controls
 */

import React, { useEffect, memo } from 'react';
import { RefreshCwIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

interface VerificationHeaderProps {
  isVerifying: boolean;
  lastVerification: Date | null;
  onRunVerification: () => void;
}

/**
 * Premium verification header with professional styling
 */
export const VerificationHeader = memo(function VerificationHeader({ isVerifying,
  lastVerification,
  onRunVerification
 }: VerificationHeaderProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('VerificationHeader component initialized', {
      componentName: 'VerificationHeader'
    });
  }, []);

  return (
    <div className="mb-6">
      <HeaderContent onRunVerification={onRunVerification} isVerifying={isVerifying} />
      <LastVerifiedTime lastVerification={lastVerification} />
    </div>
  );
});

/**
 * Header content with title and verification button
 */
const HeaderContent = memo(function HeaderContent({
  onRunVerification,
  isVerifying
}: {
  onRunVerification: () => void;
  isVerifying: boolean;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <HeaderText />
      <VerificationButton onRunVerification={onRunVerification} isVerifying={isVerifying} />
    </div>
  );
});

/**
 * Header text content
 */
const HeaderText = memo(function HeaderText(): React.JSX.Element {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Data Intelligence Verification
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Verify that all data intelligence components are working with production data
      </p>
    </div>
  );
});

/**
 * Verification action button
 */
const VerificationButton = memo(function VerificationButton({
  onRunVerification,
  isVerifying
}: {
  onRunVerification: () => void;
  isVerifying: boolean;
}): React.JSX.Element {
  return (
    <button
      onClick={onRunVerification}
      disabled={isVerifying}
      className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
    >
      <RefreshCwIcon size={16} className={isVerifying ? 'animate-spin' : ''} />
      {isVerifying ? 'Verifying...' : 'Run Verification'}
    </button>
  );
});

/**
 * Last verification timestamp
 */
const LastVerifiedTime = memo(function LastVerifiedTime({
  lastVerification
}: {
  lastVerification: Date | null;
}): React.JSX.Element {
  const logger = useLogger();
  if (!lastVerification) {
    return <div />;
  }

  return (
    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
      Last verified: {lastVerification.toLocaleString()}
    </p>
  );
});