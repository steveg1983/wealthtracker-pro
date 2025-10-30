import React from 'react';
import { getBrandLogo } from '../data/brandLogos';

interface BrandIconProps {
  domain: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function BrandIcon({ domain, size = 'md', className = '' }: BrandIconProps) {
  const brand = getBrandLogo(domain);
  
  if (!brand) {
    return null;
  }
  
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };
  
  // Handle different icon types
  if (brand.icon.startsWith('data:image')) {
    // Base64 encoded image
    return (
      <img 
        src={brand.icon} 
        alt={brand.name}
        className={`${sizeClasses[size]} object-contain ${className}`}
      />
    );
  } else if (brand.icon.startsWith('simple-icons:')) {
    // Simple Icons library reference
    // We'll need to install @iconify/react and @iconify-icons/simple-icons
    return (
      <div
        className={`${sizeClasses[size]} ${className}`}
        style={{ backgroundColor: brand.color }}
      >
        {/* Placeholder - would use Iconify here */}
        <span className="text-white text-xs">{brand.name[0]}</span>
      </div>
    );
  } else if (brand.icon.startsWith('custom:')) {
    // Custom SVG icons we create
    return (
      <div 
        className={`${sizeClasses[size]} rounded ${className}`}
        style={{ backgroundColor: brand.color }}
      >
        <span className="text-white text-xs font-bold">
          {brand.name.substring(0, 2).toUpperCase()}
        </span>
      </div>
    );
  }
  
  return null;
}