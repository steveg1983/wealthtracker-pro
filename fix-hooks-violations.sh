#!/bin/bash

# Fix React hooks violations by moving hooks outside try-catch blocks
# This script identifies components with try-catch wrapping hooks and fixes them

echo "Fixing React hooks violations..."

# List of files with hooks violations
FILES=(
  "src/components/FloatingActionButton.tsx"
  "src/components/BatchOperationsToolbar.tsx"
  "src/components/BrandIcon.tsx"
  "src/components/Confetti.tsx"
  "src/components/DataSourceIndicator.tsx"
  "src/components/EmptyState.tsx"
  "src/components/KeyboardSequenceIndicator.tsx"
  "src/components/LocalMerchantLogo.tsx"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing $file..."
    
    # Check if file has the problematic pattern
    if grep -q "^[[:space:]]*try {" "$file" && grep -q "useState\|useEffect\|useCallback\|useMemo" "$file"; then
      echo "  Found hooks inside try block, fixing..."
      
      # Create a temporary file
      temp_file="${file}.tmp"
      
      # Use sed to remove try blocks that wrap hooks
      # This is a simplified fix - for complex cases manual intervention might be needed
      sed -E '
        # Remove try { at function body start
        /^const .* = .*function.*\): React\.JSX\.Element/,/^[[:space:]]*try \{/ {
          /^[[:space:]]*try \{/d
        }
        # Fix indentation of hooks that were inside try
        s/^    (const \[.*useState)/  \1/
        s/^    (useEffect)/  \1/
        s/^    (const .* = useCallback)/  \1/
        s/^    (const .* = useMemo)/  \1/
      ' "$file" > "$temp_file"
      
      # Move the file back
      mv "$temp_file" "$file"
      echo "  Fixed $file"
    else
      echo "  No hooks violations found in $file"
    fi
  fi
done

echo "Done fixing React hooks violations!"
echo "Running eslint to verify fixes..."
npx eslint src --ext .ts,.tsx 2>&1 | grep -c "react-hooks/rules-of-hooks" | xargs echo "Remaining hooks violations:"