import React, { useState, useEffect, useRef } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  loading?: 'lazy' | 'eager';
  placeholder?: string;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * Optimized image component with:
 * - Lazy loading
 * - Placeholder support
 * - Error handling
 * - Intersection observer for visibility
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = '',
  loading = 'lazy',
  placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3Crect width="1" height="1" fill="%23f3f4f6"/%3E%3C/svg%3E',
  onLoad,
  onError
}: OptimizedImageProps): React.JSX.Element {
  const [imgSrc, setImgSrc] = useState(loading === 'lazy' ? placeholder : src);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (loading === 'eager') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setImgSrc(src);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px' // Start loading 50px before visible
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [src, loading]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    setImgSrc(placeholder);
    onError?.();
  };

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ width, height }}
    >
      <img
        ref={imgRef}
        src={imgSrc}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        onLoad={handleLoad}
        onError={handleError}
        className={`
          transition-opacity duration-300
          ${isLoaded ? 'opacity-100' : 'opacity-0'}
          ${hasError ? 'filter grayscale' : ''}
          w-full h-full object-cover
        `}
      />
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse" />
      )}
    </div>
  );
}

// WebP support detection
let webpSupport: boolean | null = null;

export function checkWebPSupport(): Promise<boolean> {
  if (webpSupport !== null) {
    return Promise.resolve(webpSupport);
  }

  return new Promise((resolve) => {
    const webP = new Image();
    webP.onload = webP.onerror = () => {
      webpSupport = webP.height === 2;
      resolve(webpSupport);
    };
    webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
  });
}

// Utility to generate optimized image URLs
export function getOptimizedImageUrl(
  src: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpg' | 'png';
  } = {}
): string {
  // If using a CDN or image optimization service, modify URL here
  // Example: return `https://cdn.example.com/image?src=${src}&w=${width}&q=${quality}`;
  
  // For now, return original source
  return src;
}

// Picture component for responsive images
interface ResponsiveImageProps extends OptimizedImageProps {
  sources?: Array<{
    srcSet: string;
    media?: string;
    type?: string;
  }>;
}

export function ResponsiveImage({
  sources = [],
  ...imageProps
}: ResponsiveImageProps): React.JSX.Element {
  if (sources.length === 0) {
    return <OptimizedImage {...imageProps} />;
  }

  return (
    <picture>
      {sources.map((source, index) => (
        <source
          key={index}
          srcSet={source.srcSet}
          media={source.media}
          type={source.type}
        />
      ))}
      <OptimizedImage {...imageProps} />
    </picture>
  );
}