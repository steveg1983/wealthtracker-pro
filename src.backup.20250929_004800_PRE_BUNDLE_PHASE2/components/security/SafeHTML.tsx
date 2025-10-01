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
    const shouldConfigure = Boolean(allowedTags?.length) || Boolean(allowedAttributes?.length);

    if (!shouldConfigure) {
      return DOMPurify.sanitize(children);
    }

    const config = {
      ...(allowedTags ? { ALLOWED_TAGS: allowedTags } : {}),
      ...(allowedAttributes ? { ALLOWED_ATTR: allowedAttributes } : {})
    };

    return DOMPurify.sanitize(children, config as Parameters<typeof DOMPurify.sanitize>[1]);
  }, [children, allowedTags, allowedAttributes]);

  return (
    <Component
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
    />
  );
};
