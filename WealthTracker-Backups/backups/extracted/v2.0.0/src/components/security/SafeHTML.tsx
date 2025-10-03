/**
 * SafeHTML Component
 * Renders HTML content safely using DOMPurify
 */

import React from 'react';
import DOMPurify from 'dompurify';

interface SafeHTMLProps {
  children: string;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
  allowedTags?: string[];
  allowedAttributes?: string[];
}

export const SafeHTML: React.FC<SafeHTMLProps> = ({
  children,
  className,
  as: Component = 'div',
  allowedTags,
  allowedAttributes,
}) => {
  const sanitizedHTML = React.useMemo(() => {
    const config: DOMPurify.Config = {};
    
    if (allowedTags) {
      config.ALLOWED_TAGS = allowedTags;
    }
    
    if (allowedAttributes) {
      config.ALLOWED_ATTR = allowedAttributes;
    }
    
    return DOMPurify.sanitize(children, config);
  }, [children, allowedTags, allowedAttributes]);

  return (
    <Component
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
    />
  );
};