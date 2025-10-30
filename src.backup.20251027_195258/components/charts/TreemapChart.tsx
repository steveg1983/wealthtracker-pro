import React from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import type { TreemapDataType, TreemapNode } from 'recharts/types/chart/Treemap';
import { useApp } from '../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import type { Transaction } from '../../types';
import { formatPercentageFromRatio, toDecimal } from '@wealthtracker/utils';

interface TreemapData {
  name: string;
  value: number;
  children?: TreemapData[];
  [key: string]: unknown;
}

interface TreemapChartProps {
  transactions: Transaction[];
}

export default function TreemapChart({ transactions }: TreemapChartProps): React.JSX.Element {
  const { categories } = useApp();
  const { formatCurrency } = useCurrencyDecimal();

  // Build hierarchical data for treemap
  const buildTreemapData = (): TreemapData => {
    const expenses = transactions.filter(t => t.type === 'expense');
    
    // Group by category
    const categoryMap = new Map<string, number>();
    expenses.forEach(t => {
      const current = categoryMap.get(t.category) || 0;
      categoryMap.set(t.category, current + t.amount);
    });

    // Build hierarchical structure
    const categoryNodes: TreemapData[] = [];

    // Group categories by parent
    const categoryGroups = new Map<string, TreemapData[]>();

    categories.forEach(cat => {
      if (cat.level === 'detail' && categoryMap.has(cat.id)) {
        const parent = categories.find(c => c.id === cat.parentId);
        if (parent) {
          if (!categoryGroups.has(parent.id)) {
            categoryGroups.set(parent.id, []);
          }
          categoryGroups.get(parent.id)!.push({
            name: cat.name,
            value: categoryMap.get(cat.id) || 0
          });
        }
      }
    });

    // Build final structure
    categoryGroups.forEach((groupChildren, parentId) => {
      const parent = categories.find(c => c.id === parentId);
      if (parent && groupChildren.length > 0) {
        const sortedChildren = [...groupChildren].sort((a, b) => b.value - a.value);
        const totalValue = sortedChildren.reduce((sum, child) => sum + child.value, 0);
        if (totalValue > 0) {
          categoryNodes.push({
            name: parent.name,
            value: totalValue,
            children: sortedChildren
          });
        }
      }
    });

    // Add uncategorized expenses
    const uncategorizedTotal = Array.from(categoryMap.entries())
      .filter(([catId]) => !categories.some(c => c.id === catId))
      .reduce((sum, [, amount]) => sum + amount, 0);
    
    if (uncategorizedTotal > 0) {
      categoryNodes.push({
        name: 'Uncategorized',
        value: uncategorizedTotal
      });
    }

    return {
      name: 'Total Expenses',
      value: categoryNodes.reduce((sum, child) => sum + child.value, 0),
      children: categoryNodes.sort((a, b) => b.value - a.value)
    };
  };

  const data = buildTreemapData();

  const convertToTreemapDataType = (
    nodes: TreemapData[]
  ): ReadonlyArray<TreemapDataType> =>
    nodes.map((node) => {
      const base: TreemapDataType = { ...node };
      if (node.children) {
        base.children = convertToTreemapDataType(node.children);
      }
      return base;
    });

  const COLORS = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
    '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6',
    '#F97316', '#06B6D4', '#84CC16', '#A855F7',
    '#64748B', '#FB923C', '#FBBF24', '#4ADE80'
  ];

  interface TooltipEntryPayload {
    name: string;
    value: number;
    parent?: {
      name: string;
      value: number;
    };
  }

  interface TooltipProps {
    active?: boolean;
    payload?: Array<{ payload: TooltipEntryPayload }>;
  }

  const CustomTooltip: React.FC<TooltipProps> = ({ active, payload }) => {
    if (!active) {
      return null;
    }

    const firstEntry = payload?.[0];
    if (!firstEntry) {
      return null;
    }

    const tooltipData = firstEntry.payload;
    const percentageOfParent = tooltipData.value > 0 && tooltipData.parent
      ? formatPercentageFromRatio(
          tooltipData.parent.value === 0
            ? toDecimal(0)
            : toDecimal(tooltipData.value).dividedBy(tooltipData.parent.value),
          1
        )
      : null;

    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="font-semibold text-gray-900 dark:text-white">{tooltipData.name}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {formatCurrency(tooltipData.value)}
        </p>
        {percentageOfParent && tooltipData.parent && (
          <p className="text-xs text-gray-500 dark:text-gray-500">
            {percentageOfParent} of {tooltipData.parent.name}
          </p>
        )}
      </div>
    );
  };

  const CustomContent: React.FC<TreemapNode> = ({
    x,
    y,
    width,
    height,
    name,
    value,
    index
  }) => {
    if (width < 50 || height < 30) {
      return null;
    }
    
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={COLORS[index % COLORS.length]}
          stroke="#fff"
          strokeWidth={2}
          rx={4}
        />
        <text
          x={x + width / 2}
          y={y + height / 2 - 6}
          fill="#fff"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={Math.min(14, width / 8)}
          fontWeight="600"
        >
          {name}
        </text>
        <text
          x={x + width / 2}
          y={y + height / 2 + 10}
          fill="#fff"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={Math.min(12, width / 10)}
        >
          {formatCurrency(value)}
        </text>
      </g>
    );
  };

  return (
    <div className="h-full min-h-[300px]">
          <ResponsiveContainer>
            <Treemap
              data={convertToTreemapDataType(data.children ?? [])}
              dataKey="value"
              aspectRatio={4 / 3}
              stroke="#fff"
              content={(node) => <CustomContent {...node} />}
            >
              <Tooltip content={(tooltipProps) => <CustomTooltip {...tooltipProps} />} />
            </Treemap>
          </ResponsiveContainer>
        </div>
      );
    }
