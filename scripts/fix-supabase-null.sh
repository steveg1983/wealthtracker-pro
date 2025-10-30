#!/bin/bash

# Fix supabase null check errors
echo "Fixing supabase null check errors..."

# Files that use supabase without null checks
files=(
  "src/services/supabaseSubscriptionService.ts"
  "src/components/RealtimeDebugger.tsx"
  "src/components/RealtimeSyncTest.tsx"
  "src/services/supabaseAccountService.ts"
  "src/services/advancedAnalyticsService.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing $file..."

    # Replace direct supabase usage with null check
    # Pattern: await supabase -> await supabase!
    sed -i '' 's/await supabase$/await supabase!/g' "$file"
    sed -i '' 's/await supabase\./await supabase!\./g' "$file"

    # For non-await cases
    sed -i '' 's/\bsupabase\.from/supabase!.from/g' "$file"
    sed -i '' 's/\bsupabase\.storage/supabase!.storage/g' "$file"
    sed -i '' 's/\bsupabase\.auth/supabase!.auth/g' "$file"
    sed -i '' 's/\bsupabase\.channel/supabase!.channel/g' "$file"

    # Avoid double !!
    sed -i '' 's/!!\.!/!\./g' "$file"
  fi
done

echo "Done fixing supabase null check errors"