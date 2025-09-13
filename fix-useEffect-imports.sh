#!/bin/bash

# Files that need useEffect import
files=(
"src/components/analytics/query-builder/SortBySection.tsx"
"src/components/analytics/QueryBuilder.tsx"
"src/components/auth/PublicRoute.tsx"
"src/components/auth/SimpleSignIn.tsx"
"src/components/Breadcrumbs.tsx"
"src/components/budget-comparison/BudgetSummaryCards.tsx"
"src/components/budget-comparison/CategoryBreakdownList.tsx"
"src/components/budget-recommendations/ApplySelectedBar.tsx"
"src/components/budget-recommendations/EmptyState.tsx"
"src/components/budget-recommendations/Header.tsx"
"src/components/budget-recommendations/LoadingState.tsx"
"src/components/budget-recommendations/RecommendationCard.tsx"
"src/components/budget-recommendations/RecommendationsList.tsx"
"src/components/budget-recommendations/SummaryCards.tsx"
"src/components/budget-templates/BudgetTemplateCard.tsx"
"src/components/budget-templates/CreateTemplateModal.tsx"
"src/components/budget-templates/EmptyTemplateState.tsx"
"src/components/budget-templates/TemplateSettingsModal.tsx"
"src/components/budget/BudgetAlerts.tsx"
"src/components/budget/BudgetCard.tsx"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    # Check if file has import from react
    if grep -q "^import.*from 'react'" "$file"; then
      # Check if useEffect is already imported
      if ! grep -q "useEffect" "$file"; then
        # Add useEffect to existing React import
        sed -i '' "s/import { memo }/import { memo, useEffect }/" "$file"
        sed -i '' "s/import { useState }/import { useState, useEffect }/" "$file"
        sed -i '' "s/import { useCallback }/import { useCallback, useEffect }/" "$file"
        sed -i '' "s/import { useMemo }/import { useMemo, useEffect }/" "$file"
        sed -i '' "s/import React, { memo }/import React, { memo, useEffect }/" "$file"
        sed -i '' "s/import React, { useState }/import React, { useState, useEffect }/" "$file"
        echo "Fixed: $file"
      fi
    fi
  fi
done