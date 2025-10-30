#!/bin/bash

# Fix Transaction.categoryId references to use Transaction.category
# This script updates all references where Transaction objects are using categoryId instead of category

echo "Fixing Transaction.categoryId references..."

# Files that have Transaction.categoryId
files=(
  "src/components/EnhancedExportManager.tsx"
  "src/components/ExcelExport.tsx"
  "src/components/SmartCategorization.tsx"
  "src/components/CategorySuggestion.tsx"
  "src/utils/calculations.ts"
  "src/utils/calculations-decimal.ts"
  "src/hooks/useActivityLogger.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing $file..."
    # Replace transaction.categoryId with transaction.category
    sed -i '' 's/transaction\.categoryId/transaction.category/g' "$file"
    # Replace t.categoryId with t.category (common shorthand)
    sed -i '' 's/\bt\.categoryId\b/t.category/g' "$file"
    # Replace trans.categoryId with trans.category
    sed -i '' 's/trans\.categoryId/trans.category/g' "$file"
  fi
done

echo "Done fixing Transaction.categoryId references"