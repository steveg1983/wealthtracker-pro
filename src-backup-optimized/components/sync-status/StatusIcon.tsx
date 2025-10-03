/**
 * Status Icon Component
 * Renders appropriate icon based on sync status
 */

import React, { useEffect } from 'react';
import { useLogger } from '../services/ServiceProvider';
import { 
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  WifiIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

interface StatusIconProps {
  status: string;
  className?: string;
}

const StatusIcon = React.memo(({ status, className = "h-5 w-5" }: StatusIconProps) => {
  switch (status) {
    case 'synced':
      return <CheckCircleIcon className={className} />;
    case 'syncing':
      return <ArrowPathIcon className={`${className} animate-spin`} />;
    case 'error':
      return <XCircleIcon className={className} />;
    case 'pending':
      return <ClockIcon className={className} />;
    case 'offline':
      return <WifiIcon className={className} />;
    default:
      return <ExclamationTriangleIcon className={className} />;
  }
});

StatusIcon.displayName = 'StatusIcon';

export default StatusIcon;