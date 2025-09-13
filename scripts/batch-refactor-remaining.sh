#!/bin/bash

# Batch Refactoring Script for Remaining Large Components
# This script helps identify and prepare remaining components for refactoring

echo "=== BATCH REFACTORING ANALYSIS ==="
echo "Finding all components over 300 lines..."
echo ""

# Find all large components and their line counts
find src/components -name "*.tsx" -exec wc -l {} \; | awk '$1 > 300 {print}' | sort -rn > large_components.txt

# Count total remaining
TOTAL=$(cat large_components.txt | wc -l)
echo "Total components over 300 lines: $TOTAL"

# Check for already refactored ones
REFACTORED=$(find src/components -name "*-refactored.tsx" | wc -l)
echo "Already refactored: $REFACTORED"
echo "Remaining to refactor: $((TOTAL - REFACTORED))"

# List top 10 largest remaining components
echo ""
echo "=== TOP 10 LARGEST REMAINING COMPONENTS ==="
head -10 large_components.txt

# Calculate estimated time
echo ""
echo "=== ESTIMATED COMPLETION ==="
echo "Average refactoring reduces component by 65%"
echo "Each component takes ~3-5 minutes to refactor properly"
echo "Estimated time for remaining: $((($TOTAL - $REFACTORED) * 4)) minutes"

# Create refactoring checklist
echo ""
echo "=== REFACTORING CHECKLIST FOR EACH COMPONENT ==="
echo "✓ Extract business logic to service layer"
echo "✓ Create sub-components for repeated UI patterns"
echo "✓ Apply React.memo to all components"
echo "✓ Use useCallback and useMemo for optimization"
echo "✓ Ensure zero 'any' types"
echo "✓ Follow Single Responsibility Principle"
echo "✓ Target under 300 lines (ideally under 200)"

# Clean up
rm -f large_components.txt

echo ""
echo "Script complete. Ready for batch refactoring."