import React, { useState, useEffect } from 'react';

interface ProgressiveImageProps {
  src: string;
  placeholder?: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
}

export const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  src,
  placeholder,
  alt,
  className = '',
  loading = 'lazy'
}) => {
  const [imgSrc, setImgSrc] = useState(placeholder || '');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      setImgSrc(src);
      setIsLoading(false);
    };
  }, [src]);

  return (
    <img
      src={imgSrc}
      alt={alt}
      loading={loading}
      className={`${className} ${isLoading ? 'blur-sm' : ''} transition-all duration-300`}
    />
  );
};