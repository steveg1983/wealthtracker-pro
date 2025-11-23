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

export function withSanitizedProps<C extends React.ComponentType<Record<string, unknown>>>(
  Component: C,
  options: SanitizeOptions = {}
) {
  type Props = React.ComponentPropsWithoutRef<C>;
  type RefType = React.ComponentRef<C>;

  const { exclude = [], includeNumbers = true, includeDates = true } = options;

  const sanitizeValue = (value: unknown): unknown => {
    if (typeof value === 'string') {
      return sanitizeText(value);
    }

    if (typeof value === 'number' && includeNumbers) {
      return sanitizeNumber(value);
    }

    if (value instanceof Date && includeDates) {
      return sanitizeDate(value);
    }

    if (Array.isArray(value)) {
      return value.map(item => sanitizeValue(item));
    }

    return value;
  };

  const Sanitized = React.forwardRef<RefType, Props>((props, ref) => {
    const sanitizedProps = React.useMemo(() => {
      const result: Partial<Props> = {};

      (Object.entries(props) as Array<[keyof Props, Props[keyof Props]]>).forEach(([key, value]) => {
        if (exclude.includes(String(key))) {
          result[key] = value;
          return;
        }

        result[key] = sanitizeValue(value) as Props[keyof Props];
      });

      return result as Props;
    }, [props]);

    return <Component {...sanitizedProps} ref={ref} />;
  });

  Sanitized.displayName = `withSanitizedProps(${Component.displayName ?? Component.name ?? 'Component'})`;

  return Sanitized;
}
