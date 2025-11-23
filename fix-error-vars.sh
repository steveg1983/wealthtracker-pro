#!/bin/bash

# Fix all instances where catch blocks use `_error` but then reference `error`
# This script will replace `, error)` with `, _error)` in specific patterns

FILES=(
  "src/services/storageAdapter.ts"
  "src/services/sharedFinanceService.ts"
  "src/services/smartCacheService.ts"
  "src/services/stockPriceService.ts"
  "src/services/realtimeService.ts"
  "src/services/predictiveLoadingService.ts"
)

for FILE in "${FILES[@]}"; do
  if [ -f "$FILE" ]; then
    echo "Fixing $FILE..."
    # Replace error) with _error) when preceded by logger.error, console.error, or similar patterns
    sed -i '' 's/, error);/, _error);/g' "$FILE"
    sed -i '' 's/, error)/,_error)/g' "$FILE"
    sed -i '' "s/': error/': _error/g" "$FILE"
  fi
done

echo "Done!"
