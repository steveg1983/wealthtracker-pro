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

export function withSanitizedProps<P extends Record<string, unknown>>(
  Component: React.ComponentType<P>,
  options: SanitizeOptions = {}
) {
  const { exclude: defaultExclude = [], includeNumbers = true, includeDates = true } = options;

  const WrappedComponent = React.forwardRef<React.ComponentRef<typeof Component>, P>((props, ref) => {
    const excludedKeys = new Set(defaultExclude.map(key => key.toString()));
    const result: Partial<P> = {};
    const entries = Object.entries(props) as Array<[keyof P, P[keyof P]]>;

    for (const [key, value] of entries) {
      if (excludedKeys.has(String(key))) {
        result[key] = value;
        continue;
      }

      if (typeof value === 'string') {
        result[key] = sanitizeText(value) as P[typeof key];
      } else if (typeof value === 'number' && includeNumbers) {
        result[key] = sanitizeNumber(value) as P[typeof key];
      } else if (value instanceof Date && includeDates) {
        result[key] = sanitizeDate(value) as P[typeof key];
      } else if (Array.isArray(value)) {
        result[key] = value.map(item => {
          if (typeof item === 'string') return sanitizeText(item);
          if (typeof item === 'number' && includeNumbers) return sanitizeNumber(item);
          if (item instanceof Date && includeDates) return sanitizeDate(item);
          return item;
        }) as P[typeof key];
      } else {
        result[key] = value;
      }
    }

    return <Component {...(result as P)} ref={ref} />;
  });

  WrappedComponent.displayName = `withSanitizedProps(${Component.displayName ?? Component.name ?? 'Component'})`;

  return WrappedComponent;
}
