/**
 * Higher-Order Component that sanitizes all string props
 * Wrap any component with this to automatically sanitize its inputs
 */

import React from 'react';
import { sanitizeText, sanitizeNumber, sanitizeDate } from '../../security/xss-protection';

type SanitizeOptions = {
  exclude?: string[]; // Props to exclude from sanitization
  includeNumbers?: boolean; // Whether to sanitize number props
  includeDates?: boolean; // Whether to sanitize date props
};

export function withSanitizedProps<P extends Record<string, any>>(
  Component: React.ComponentType<P>,
  options: SanitizeOptions = {}
) {
  const { exclude = [], includeNumbers = true, includeDates = true } = options;

  return React.forwardRef<any, P>((props, ref) => {
    const sanitizedProps = React.useMemo(() => {
      const result: any = {};

      for (const [key, value] of Object.entries(props)) {
        if (exclude.includes(key)) {
          result[key] = value;
          continue;
        }

        if (typeof value === 'string') {
          result[key] = sanitizeText(value);
        } else if (typeof value === 'number' && includeNumbers) {
          result[key] = sanitizeNumber(value);
        } else if (value instanceof Date && includeDates) {
          result[key] = sanitizeDate(value);
        } else if (Array.isArray(value)) {
          result[key] = value.map(item => {
            if (typeof item === 'string') return sanitizeText(item);
            if (typeof item === 'number' && includeNumbers) return sanitizeNumber(item);
            if (item instanceof Date && includeDates) return sanitizeDate(item);
            return item;
          });
        } else {
          result[key] = value;
        }
      }

      return result as P;
    }, [props]);

    return <Component {...sanitizedProps} ref={ref} />;
  });
}