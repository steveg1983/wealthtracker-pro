#!/bin/bash

# Safe cleanup script - only removes duplicates that are clearly mistakes
# Preserves architectural improvements in hooks

echo "🧹 Safe Cleanup of Duplicate Files"
echo "==================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📊 Analyzing Duplicate Files${NC}"
echo "-----------------------------"

# Categories of duplicates
echo -e "\n${YELLOW}1. Hook Files (Architectural Improvements - KEEP FOR NOW)${NC}"
find src/hooks -name "*-refactored.*" | while read file; do
  echo "  KEEP: $(basename $file) - Contains service architecture"
done

echo -e "\n${YELLOW}2. Component Files (Just JSDoc/memo added - SAFE TO MERGE)${NC}"
find src/components -name "*-refactored.tsx" | while read file; do
  echo "  MERGE: $(basename $file)"
done

echo -e "\n${YELLOW}3. Page Files (Just JSDoc/memo added - SAFE TO REMOVE)${NC}"
find src/pages -name "*-refactored.tsx" | while read file; do
  echo "  REMOVE: $(basename $file)"
done

echo -e "\n${BLUE}🗑️  Safe Removal Plan${NC}"
echo "--------------------"
echo "The following files are safe to remove (they only have JSDoc/memo added):"
echo ""

# List pages that can be safely removed
pages_to_remove=$(find src/pages -name "*-refactored.tsx")
if [ ! -z "$pages_to_remove" ]; then
  echo -e "${RED}Pages to remove:${NC}"
  echo "$pages_to_remove" | while read file; do
    echo "  rm $file"
  done
fi

echo ""
echo -e "${YELLOW}⚠️  Manual Action Required:${NC}"
echo "1. Components need JSDoc/memo manually merged from -refactored versions"
echo "2. Hooks should be kept until we verify the architectural improvements"
echo "3. After merging component improvements, remove component -refactored files"
echo ""

read -p "Remove page duplicates now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}Removing page duplicates...${NC}"
    find src/pages -name "*-refactored.tsx" -exec rm {} \;
    echo "✓ Page duplicates removed"
else
    echo "Skipped removal"
fi

# Final summary
echo ""
echo -e "${BLUE}📊 Remaining Work${NC}"
echo "-----------------"
components_remaining=$(find src/components -name "*-refactored.tsx" | wc -l)
hooks_remaining=$(find src/hooks -name "*-refactored.*" | wc -l)

echo "Component duplicates to merge: $components_remaining"
echo "Hook refactors to evaluate: $hooks_remaining"
echo ""
echo "Next steps:"
echo "1. For each component -refactored file:"
echo "   - Extract JSDoc comments"
echo "   - Extract React.memo wrapper"
echo "   - Apply to original file"
echo "   - Delete -refactored file"
echo "2. For hook files:"
echo "   - These contain architectural improvements"
echo "   - Need careful evaluation before replacing originals"