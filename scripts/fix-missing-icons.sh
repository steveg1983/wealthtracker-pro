#!/bin/bash

# Fix missing icon imports by mapping to existing ones
echo "Fixing missing icon imports..."

# Map missing icons to existing ones
declare -A icon_map=(
  ["CheckSquareIcon"]="CheckIcon"
  ["SparklesIcon"]="StarIcon"
  ["ContrastIcon"]="SettingsIcon"
  ["Layers3Icon"]="LayersIcon"
  ["NetworkIcon"]="GridIcon"
  ["ArrowUpDownIcon"]="ArrowUpIcon"
)

# Find and replace in all TypeScript files
for old_icon in "${!icon_map[@]}"; do
  new_icon="${icon_map[$old_icon]}"
  echo "Replacing $old_icon with $new_icon..."

  # Find files that import the missing icon
  files=$(grep -l "$old_icon" src/**/*.tsx src/**/*.ts 2>/dev/null || true)

  for file in $files; do
    if [ -f "$file" ]; then
      # Replace in import statements
      sed -i '' "s/\b$old_icon\b/$new_icon as $old_icon/g" "$file"

      # Clean up double aliasing
      sed -i '' "s/as $old_icon as $old_icon/as $old_icon/g" "$file"
    fi
  done
done

echo "Done fixing missing icon imports"