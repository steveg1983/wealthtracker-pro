#!/bin/bash

# Script to merge excellence improvements from -refactored component files
# and then delete the duplicates

echo "🔧 Merging Component Excellence Improvements"
echo "==========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counter
merged=0
errors=0

# List remaining component duplicates
components=$(find src/components -name "*-refactored.tsx" | sort)
total=$(echo "$components" | grep -c "refactored" || echo "0")

echo -e "${BLUE}Found $total component duplicates to merge${NC}"
echo ""

for refactored in $components; do
  original="${refactored%-refactored.tsx}.tsx"
  filename=$(basename "$original")
  
  if [ -f "$original" ]; then
    echo -e "${YELLOW}Processing:${NC} $filename"
    
    # Check if original already has React.memo
    has_memo=$(grep -c "React.memo\|memo(" "$original" || echo "0")
    
    # Check if original already has JSDoc
    has_jsdoc=$(grep -c "@component\|@description" "$original" || echo "0")
    
    if [ "$has_memo" -eq "0" ] || [ "$has_jsdoc" -eq "0" ]; then
      echo -e "  ${RED}⚠️  Needs manual merge${NC}"
      echo "    Missing: $([ "$has_memo" -eq "0" ] && echo "React.memo") $([ "$has_jsdoc" -eq "0" ] && echo "JSDoc")"
      echo "    Original: $original"
      echo "    Refactored: $refactored"
      echo ""
      ((errors++))
    else
      echo -e "  ${GREEN}✓${NC} Already has JSDoc and React.memo"
      echo "    Removing duplicate..."
      rm "$refactored"
      ((merged++))
    fi
  else
    echo -e "${RED}ERROR:${NC} Original not found for $refactored"
    ((errors++))
  fi
done

echo ""
echo -e "${BLUE}📊 Summary${NC}"
echo "---------"
echo "Successfully handled: ${GREEN}$merged${NC}"
echo "Need manual merge: ${YELLOW}$errors${NC}"
echo ""

if [ "$errors" -gt "0" ]; then
  echo -e "${YELLOW}Manual merge needed for:${NC}"
  find src/components -name "*-refactored.tsx" | while read file; do
    echo "  - $(basename $file)"
  done
  echo ""
  echo "For each file:"
  echo "1. Open the -refactored version"
  echo "2. Copy the JSDoc comment block"
  echo "3. Copy the React.memo wrapper"
  echo "4. Apply to the original file"
  echo "5. Delete the -refactored file"
fi