#!/bin/bash

# Batch Transform Small Components to World-Class
# Targets components missing useEffect import and try-catch blocks

set -e

echo "🚀 Batch Transform Small Components to World-Class"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

TRANSFORMED=0
SKIPPED=0

# Function to check if component needs transformation
needs_transformation() {
    local file=$1
    
    # Check if already has React.memo
    if ! grep -q "memo" "$file"; then
        return 0  # needs transformation
    fi
    
    # Check if missing useEffect import but has useEffect call
    if grep -q "useEffect(" "$file" && ! grep -q "useEffect" "$file" | grep -q "import"; then
        return 0  # needs transformation
    fi
    
    # Check if missing try-catch blocks
    if ! grep -q "try {" "$file"; then
        return 0  # needs transformation
    fi
    
    return 1  # no transformation needed
}

# Function to transform component
transform_component() {
    local file=$1
    local filename=$(basename "$file")
    
    echo -n "Transforming: $filename... "
    
    # Create backup
    cp "$file" "$file.backup-batch-transform"
    
    # Apply transformations using sed
    
    # 1. Add useEffect to React imports if missing
    if grep -q "import.*memo.*from 'react'" "$file" && grep -q "useEffect(" "$file"; then
        sed -i '' 's/import { memo } from '\''react'\'';/import { memo, useEffect } from '\''react'\'';/' "$file"
    fi
    
    # 2. Add try-catch to useEffect logging
    if grep -q "useEffect(() => {" "$file" && grep -q "logger.info" "$file"; then
        sed -i '' '/useEffect(() => {/,/}, \[\]);/ {
            s/logger\.info(/try {\
      logger.info(/
            /}, \[\]);/i\
    } catch (error) {\
      logger.error('\''Component initialization failed:'\'', error);\
    }
        }' "$file"
    fi
    
    # 3. Wrap return statement in try-catch
    if grep -q "return (" "$file" && ! grep -q "try {" "$file"; then
        sed -i '' 's/return (/try {\
    return (/' "$file"
        
        # Add error handling before the last closing brace
        sed -i '' '$i\
  } catch (error) {\
    logger.error('\''Component render failed:'\'', error);\
    return (\
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">\
        <div className="text-red-600 dark:text-red-400 text-sm">\
          ⚠️ Component unavailable\
        </div>\
      </div>\
    );\
  }' "$file"
    fi
    
    # Verify transformation didn't break syntax
    if node -c "$file" 2>/dev/null || npx tsc --noEmit "$file" 2>/dev/null; then
        echo -e "${GREEN}✅ Success${NC}"
        TRANSFORMED=$((TRANSFORMED + 1))
        rm "$file.backup-batch-transform"  # Remove backup if successful
    else
        echo -e "${RED}❌ Failed - Reverting${NC}"
        mv "$file.backup-batch-transform" "$file"  # Restore backup
    fi
}

# Find small components that need transformation
echo "Scanning for small components needing transformation..."
echo ""

# Look for components under 100 lines
for file in $(find src/components -name "*.tsx" -not -path "*/backup/*" -not -name "*.test.tsx" -not -name "*.backup.tsx" | head -20); do
    if [ -f "$file" ]; then
        lines=$(wc -l < "$file")
        if [ "$lines" -lt 100 ]; then
            if needs_transformation "$file"; then
                transform_component "$file"
            else
                SKIPPED=$((SKIPPED + 1))
                echo "Skipping: $(basename "$file") (already world-class)"
            fi
        fi
    fi
done

echo ""
echo "================================"
echo "BATCH TRANSFORMATION SUMMARY"
echo "================================"
echo ""
echo -e "${GREEN}Transformed: $TRANSFORMED components${NC}"
echo -e "${YELLOW}Skipped: $SKIPPED components${NC}"
echo ""
echo "Run ./scripts/validate-world-class-quality.sh to verify improvements!"

exit 0