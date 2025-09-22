#!/bin/bash

echo "Removing all logger usage from components without ServiceProvider hook..."

# Remove logger statements from components that don't import useLogger
find src/components -type f \( -name "*.tsx" -o -name "*.ts" \) -exec grep -L "useLogger" {} \; | while read file; do
  sed -i '' '/^[[:space:]]*logger\./d' "$file"
done

echo "Fixing Recharts imports in AllocationAnalysis components..."
# These components need to use DynamicChart instead
sed -i '' '/ResponsiveContainer/d; /Treemap/d; /Tooltip/d; /PieChart/d; /BarChart/d; /LineChart/d; /Cell/d; /Legend/d' \
  src/components/allocation-analysis/AllocationTreemap.tsx \
  src/components/AllocationAnalysis.tsx

echo "Done!"