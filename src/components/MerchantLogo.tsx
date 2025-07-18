import React, { useMemo } from 'react';
import { merchantLogoService } from '../services/merchantLogoService';

interface MerchantLogoProps {
  description: string;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  className?: string;
}

export default function MerchantLogo({ 
  description, 
  size = 'md', 
  showName = false,
  className = ''
}: MerchantLogoProps) {
  const merchantInfo = useMemo(() => 
    merchantLogoService.getMerchantInfo(description),
    [description]
  );

  if (!merchantInfo) {
    return null;
  }

  const sizeClasses = {
    sm: 'w-6 h-6 text-sm',
    md: 'w-8 h-8 text-base',
    lg: 'w-10 h-10 text-lg'
  };

  const logoSizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl'
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div 
        className={`${sizeClasses[size]} rounded-lg flex items-center justify-center shadow-sm`}
        style={{ backgroundColor: `${merchantInfo.color}20` }}
        title={merchantInfo.name}
      >
        <span className={`${logoSizeClasses[size]}`} role="img" aria-label={merchantInfo.name}>
          {merchantInfo.logo}
        </span>
      </div>
      {showName && (
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {merchantInfo.name}
        </span>
      )}
    </div>
  );
}