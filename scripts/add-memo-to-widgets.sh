#!/bin/bash

# Script to add React.memo to dashboard widgets

echo "🚀 Adding React.memo to dashboard widgets..."

for file in src/components/dashboard/widgets/*.tsx; do
  if [ -f "$file" ]; then
    filename=$(basename "$file")
    
    # Skip if already has memo
    if grep -q "memo(" "$file"; then
      echo "✓ Already memoized: $filename"
      continue
    fi
    
    echo "Adding memo to: $filename"
    
    # Add memo import if not present
    if ! grep -q "import.*memo" "$file"; then
      # Check if React import exists and add memo to it
      if grep -q "^import React" "$file"; then
        sed -i '' 's/^import React/import React, { memo }/' "$file"
      else
        sed -i '' 's/^import {/import { memo,/' "$file"
      fi
    fi
    
    # Find the function name and wrap export with memo
    funcname=$(grep -E "^export default function |^function " "$file" | sed -E 's/(export default function |function )([A-Za-z0-9]+).*/\2/' | head -1)
    
    if [ -n "$funcname" ]; then
      # Change export default function to just function
      sed -i '' "s/^export default function $funcname/function $funcname/" "$file"
      
      # Add memo export at the end
      echo "" >> "$file"
      echo "export default memo($funcname);" >> "$file"
      
      echo "✅ Memoized: $filename"
    fi
  fi
done

echo "✨ Dashboard widgets memoization complete!"