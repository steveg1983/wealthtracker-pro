import React, { useMemo } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import type { Transaction, Account } from '../../types';

interface SankeyNode {
  name: string;
  color?: string;
}

interface SankeyLink {
  source: number;
  target: number;
  value: number;
}

interface SankeyChartProps {
  transactions: Transaction[];
  accounts: Account[];
}

export default function SankeyChart({ transactions, accounts: _accounts }: SankeyChartProps): React.JSX.Element {
  const { categories } = useApp();
  const { formatCurrency } = useCurrencyDecimal();

  const sankeyData = useMemo(() => {
    const nodes: SankeyNode[] = [];
    const links: SankeyLink[] = [];
    const nodeMap = new Map<string, number>();

    // Helper to add/get node index
    const getNodeIndex = (name: string, color?: string): number => {
      if (!nodeMap.has(name)) {
        nodeMap.set(name, nodes.length);
        nodes.push(color ? { name, color } : { name });
      }
      return nodeMap.get(name)!;
    };

    // Add income sources
    const incomeByCategory = new Map<string, number>();
    transactions
      .filter(t => t.type === 'income')
      .forEach(t => {
        const category = categories.find(c => c.id === t.category)?.name || 'Other Income';
        incomeByCategory.set(category, (incomeByCategory.get(category) || 0) + t.amount);
      });

    // Add expense categories
    const expenseByCategory = new Map<string, number>();
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const category = categories.find(c => c.id === t.category)?.name || 'Other Expenses';
        expenseByCategory.set(category, (expenseByCategory.get(category) || 0) + t.amount);
      });

    // Create nodes and links
    const accountsNodeIndex = getNodeIndex('Accounts', '#6366F1');

    // Income -> Accounts
    incomeByCategory.forEach((amount, category) => {
      const sourceIndex = getNodeIndex(category, '#10B981');
      links.push({
        source: sourceIndex,
        target: accountsNodeIndex,
        value: amount
      });
    });

    // Accounts -> Expenses
    expenseByCategory.forEach((amount, category) => {
      const targetIndex = getNodeIndex(category, '#EF4444');
      links.push({
        source: accountsNodeIndex,
        target: targetIndex,
        value: amount
      });
    });

    return { nodes, links };
  }, [transactions, categories]);

  // Simple SVG-based Sankey visualization
  const { nodes, links } = sankeyData;
  const maxLinkValue = useMemo(() => (links.length > 0 ? Math.max(...links.map(l => l.value)) : 1), [links]);
  const width = 800;
  const height = 600;
  const nodeWidth = 20;
  const nodePadding = 10;

  // Calculate node positions
  const nodePositions = useMemo(() => {
    const positions: { x: number; y: number; height: number }[] = [];
    const safeMaxValue = Math.max(maxLinkValue, 1);
    
    // Group nodes by column (income, accounts, expenses)
    const incomeNodes: number[] = [];
    const accountNodes: number[] = [];
    const expenseNodes: number[] = [];

    nodes.forEach((node, i) => {
      if (node.name === 'Accounts') {
        accountNodes.push(i);
      } else if (links.some(l => l.source === i)) {
        incomeNodes.push(i);
      } else {
        expenseNodes.push(i);
      }
    });

    const columns: number[][] = [incomeNodes, accountNodes, expenseNodes];

    // Position nodes in each column
    columns.forEach((column, colIndex) => {
      const totalValue = column.reduce((sum, nodeIndex) => {
        const nodeValue = links
          .filter(l => l.source === nodeIndex || l.target === nodeIndex)
          .reduce((s, l) => s + l.value, 0);
        return sum + nodeValue;
      }, 0);

      const columnHeight = (totalValue / safeMaxValue) * height;
      let currentY = (height - columnHeight) / 2;

      column.forEach(nodeIndex => {
        const nodeValue = links
          .filter(l => l.source === nodeIndex || l.target === nodeIndex)
          .reduce((s, l) => s + l.value, 0);
        const nodeHeight = (nodeValue / safeMaxValue) * height * 0.8;

        positions[nodeIndex] = {
          x: colIndex * (width / 3) + 50,
          y: currentY,
          height: Math.max(nodeHeight, 20)
        };

        currentY += nodeHeight + nodePadding;
      });
    });

    return positions;
  }, [nodes, links, height, nodePadding, width, maxLinkValue]);

  // Generate path for links
  const generatePath = (link: SankeyLink): string => {
    const sourcePos = nodePositions[link.source];
    const targetPos = nodePositions[link.target];
    
    if (!sourcePos || !targetPos) return '';
    
    const safeMaxValue = Math.max(maxLinkValue, 1);
    const linkHeight = (link.value / safeMaxValue) * height * 0.8;
    
    const sx = sourcePos.x + nodeWidth;
    const sy = sourcePos.y + sourcePos.height / 2;
    const tx = targetPos.x;
    const ty = targetPos.y + targetPos.height / 2;
    
    const midX = (sx + tx) / 2;
    
    return `
      M ${sx} ${sy - linkHeight / 2}
      C ${midX} ${sy - linkHeight / 2}, ${midX} ${ty - linkHeight / 2}, ${tx} ${ty - linkHeight / 2}
      L ${tx} ${ty + linkHeight / 2}
      C ${midX} ${ty + linkHeight / 2}, ${midX} ${sy + linkHeight / 2}, ${sx} ${sy + linkHeight / 2}
      Z
    `;
  };

  return (
    <div className="h-full min-h-[300px] flex flex-col">
      <div className="flex-1 overflow-x-auto">
        <svg width={width} height={height} className="mx-auto">
          {/* Links */}
          <g className="links">
            {links.map((link, i) => {
              const sourceNode = nodes[link.source];
              const targetNode = nodes[link.target];
              const pathData = generatePath(link);

              if (!sourceNode || !targetNode || !pathData) {
                return null;
              }

              return (
                <path
                  key={i}
                  d={pathData}
                  fill={sourceNode.color ?? '#94A3B8'}
                  opacity={0.3}
                  className="hover:opacity-50 transition-opacity"
                >
                  <title>
                    {sourceNode.name} → {targetNode.name}: {formatCurrency(link.value)}
                  </title>
                </path>
              );
            })}
          </g>
          
          {/* Nodes */}
          <g className="nodes">
            {nodes.map((node, i) => {
              const pos = nodePositions[i];
              if (!pos) return null;
              
              return (
                <g key={i} transform={`translate(${pos.x}, ${pos.y})`}>
                  <rect
                    width={nodeWidth}
                    height={pos.height}
                    fill={node.color || '#64748B'}
                    className="hover:opacity-80 transition-opacity"
                  />
                  <text
                    x={node.name === 'Accounts' ? nodeWidth / 2 : (i < nodes.length / 2 ? -5 : nodeWidth + 5)}
                    y={pos.height / 2}
                    textAnchor={node.name === 'Accounts' ? 'middle' : (i < nodes.length / 2 ? 'end' : 'start')}
                    dominantBaseline="central"
                    className="text-sm fill-gray-700 dark:fill-gray-300"
                  >
                    {node.name}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 justify-center">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">Income</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-indigo-500 rounded"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">Accounts</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">Expenses</span>
        </div>
      </div>
    </div>
  );
}
