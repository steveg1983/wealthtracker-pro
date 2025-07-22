import React, { useMemo, useState, useEffect } from 'react';
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
}: MerchantLogoProps): React.JSX.Element | null {
  const merchantInfo = useMemo(() => 
    merchantLogoService.getMerchantInfo(description),
    [description]
  );
  
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (merchantInfo?.domain) {
      setIsLoading(true);
      merchantLogoService.fetchLogoUrl(merchantInfo.domain)
        .then(url => {
          setLogoUrl(url);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setLogoUrl(null);
    }
  }, [merchantInfo]);

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
  
  const imageSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div 
        className={`${sizeClasses[size]} rounded-lg flex items-center justify-center shadow-sm overflow-hidden`}
        style={{ backgroundColor: `${merchantInfo.color}20` }}
        title={merchantInfo.name}
      >
        {isLoading ? (
          <div className={`${imageSizeClasses[size]} animate-pulse bg-gray-300 dark:bg-gray-600 rounded`} />
        ) : logoUrl ? (
          <img 
            src={logoUrl} 
            alt={merchantInfo.name}
            className={`${imageSizeClasses[size]} object-contain`}
            onError={(e) => {
              // If image fails to load, remove it and fall back to emoji
              setLogoUrl(null);
            }}
          />
        ) : (
          <span className={`${logoSizeClasses[size]}`} role="img" aria-label={merchantInfo.name}>
            {merchantInfo.logo}
          </span>
        )}
      </div>
      {showName && (
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {merchantInfo.name}
        </span>
      )}
    </div>
  );
}