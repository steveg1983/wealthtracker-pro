import React from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import type { TreemapNode } from 'recharts/types/chart/Treemap';
import { useApp } from '../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import type { Transaction } from '../../types';
import { formatDecimal } from '../../utils/decimal-format';

interface TreemapData {
  name: string;
  value: number;
  children?: TreemapData[];
  [key: string]: unknown; // Index signature for Recharts compatibility
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
    const children: TreemapData[] = [];
    
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
    categoryGroups.forEach((children, parentId) => {
      const parent = categories.find(c => c.id === parentId);
      if (parent && children.length > 0) {
        const totalValue = children.reduce((sum, child) => sum + child.value, 0);
        if (totalValue > 0) {
          children.push({
            name: parent.name,
            value: totalValue,
            children: children.sort((a, b) => b.value - a.value)
          });
        }
      }
    });

    // Add uncategorized expenses
    const uncategorizedTotal = Array.from(categoryMap.entries())
      .filter(([catId]) => !categories.some(c => c.id === catId))
      .reduce((sum, [, amount]) => sum + amount, 0);
    
    if (uncategorizedTotal > 0) {
      children.push({
        name: 'Uncategorized',
        value: uncategorizedTotal
      });
    }

    return {
      name: 'Total Expenses',
      value: children.reduce((sum, child) => sum + child.value, 0),
      children: children.sort((a, b) => b.value - a.value)
    };
  };

  const data = buildTreemapData();

  const COLORS = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
    '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6',
    '#F97316', '#06B6D4', '#84CC16', '#A855F7',
    '#64748B', '#FB923C', '#FBBF24', '#4ADE80'
  ];

  interface TooltipProps {
    active?: boolean;
    payload?: Array<{
      payload: {
        name: string;
        value: number;
        parent?: {
          name: string;
          value: number;
        };
      };
    }>;
  }

  const CustomTooltip = ({ active, payload }: TooltipProps): React.JSX.Element | null => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#d4dce8] dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-white">{data.name}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {formatCurrency(data.value)}
          </p>
          {data.value > 0 && data.parent && (
            <p className="text-xs text-gray-500 dark:text-gray-500">
              {formatDecimal((data.value / data.parent.value) * 100, 1)}% of {data.parent.name}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const CustomContent = (props: TreemapNode): React.JSX.Element | null => {
    const { x, y, width, height, name, value, index } = props;
    if (width < 50 || height < 30) return null;
    
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
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={data.children ?? []}
          dataKey="value"
          aspectRatio={4 / 3}
          stroke="#fff"
          content={(props: TreemapNode) => <CustomContent {...props} />}
        >
          <Tooltip content={<CustomTooltip />} />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
