#!/bin/bash

# Fix snake_case to camelCase property names
echo "Fixing updated_at to updatedAt in useRealtimeSync.ts..."

file="src/hooks/useRealtimeSync.ts"

if [ -f "$file" ]; then
  # Replace .updated_at with .updatedAt
  sed -i '' 's/\.updated_at/\.updatedAt/g' "$file"

  # Replace ['updated_at'] with ['updatedAt']
  sed -i '' "s/\['updated_at'\]/\['updatedAt'\]/g" "$file"

  echo "Fixed updated_at references in $file"
fi

echo "Done fixing updated_at property names"