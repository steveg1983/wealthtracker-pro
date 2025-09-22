import React from 'react';

interface RealtimeStatusDotProps {
  status?: 'online' | 'offline' | 'syncing';
  className?: string;
}

export default function RealtimeStatusDot({
  status = 'online',
  className = ''
}: RealtimeStatusDotProps): React.JSX.Element {
  const getStatusColor = () => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'offline':
        return 'bg-gray-400';
      case 'syncing':
        return 'bg-yellow-500 animate-pulse';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${getStatusColor()} ${className}`}
      aria-label={`Status: ${status}`}
    />
  );
}
