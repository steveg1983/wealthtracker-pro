#!/bin/bash

# Fix remaining errors in specific files

# Fix stripeService.ts error variables
FILE="src/services/stripeService.ts"
if [ -f "$FILE" ]; then
  sed -i '' 's/, error);/, _error);/g' "$FILE"
  sed -i '' 's/, error)/,_error)/g' "$FILE"
  sed -i '' "s/': error/': _error/g" "$FILE"
fi

# Fix stockPriceService.ts error variables
FILE="src/services/stockPriceService.ts"
if [ -f "$FILE" ]; then
  sed -i '' 's/, error);/, _error);/g' "$FILE"
  sed -i '' 's/, error)/,_error)/g' "$FILE"
  sed -i '' "s/': error/': _error/g" "$FILE"
fi

# Fix realtimeService.ts error variable
FILE="src/services/realtimeService.ts"
if [ -f "$FILE" ]; then
  sed -i '' 's/, error);/, _error);/g' "$FILE"
  sed -i '' 's/, error)/,_error)/g' "$FILE"
  sed -i '' "s/': error/': _error/g" "$FILE"
fi

# Fix smartCacheService.ts error variable  
FILE="src/services/smartCacheService.ts"
if [ -f "$FILE" ]; then
  sed -i '' 's/, error);/, _error);/g' "$FILE"
  sed -i '' 's/, error)/,_error)/g' "$FILE"
  sed -i '' "s/': error/': _error/g" "$FILE"
fi

echo "Done fixing error variables!"
