import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { localMerchantLogoService } from '../services/localMerchantLogoService';
import { getBrandLogoSVG } from '../data/brandLogosSVG';

interface LocalMerchantLogoProps {
  description: string;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  className?: string;
}

export default function LocalMerchantLogo({ 
  description, 
  size = 'md', 
  showName = false,
  className = ''
}: LocalMerchantLogoProps) {
  const merchantInfo = useMemo(() => 
    localMerchantLogoService.getMerchantInfo(description),
    [description]
  );

  if (!merchantInfo) {
    return null;
  }

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10'
  };

  // Get brand key for logo lookup
  const brandKey = merchantInfo.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Get SVG logo (either specific or letter-based fallback)
  const rawLogoSVG = getBrandLogoSVG(brandKey, merchantInfo.name, merchantInfo.color);
  
  // Sanitize SVG to prevent XSS
  const logoSVG = DOMPurify.sanitize(rawLogoSVG, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ['svg', 'defs', 'pattern', 'image', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan'],
    ADD_ATTR: ['viewBox', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'd', 'transform', 'xmlns', 'xmlns:xlink', 'xlink:href', 'style', 'class', 'id', 'patternUnits', 'preserveAspectRatio']
  });

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div 
        className={`${sizeClasses[size]} rounded-lg flex items-center justify-center shadow-sm overflow-hidden p-0`}
        title={merchantInfo.name}
      >
        <div 
          className="w-full h-full"
          dangerouslySetInnerHTML={{ __html: logoSVG }}
        />
      </div>
      
      {showName && (
        <div>
          <span className={`text-sm font-medium text-gray-700 dark:text-gray-300`}>
            {merchantInfo.name}
          </span>
          <span className={`text-xs text-gray-500 dark:text-gray-400 block`}>
            {merchantInfo.category}
          </span>
        </div>
      )}
    </div>
  );
}