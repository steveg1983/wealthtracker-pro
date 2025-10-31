import { useCallback } from 'react';

interface RowHeightOptions {
  padding?: number;
  hasSubtext?: boolean;
  hasActions?: boolean;
  hasTags?: boolean;
}

export function useRowHeightCalculator(
  baseHeight: number,
  options: RowHeightOptions = {}
): () => number {
  const { padding = 0, hasSubtext = false, hasActions = false, hasTags = false } = options;

  return useCallback(() => {
    let height = baseHeight;

    if (padding) {
      height += padding * 2;
    }

    if (hasSubtext) {
      height += 20;
    }

    if (hasActions) {
      height += 24;
    }

    if (hasTags) {
      height += 24;
    }

    return height;
  }, [baseHeight, padding, hasSubtext, hasActions, hasTags]);
}
