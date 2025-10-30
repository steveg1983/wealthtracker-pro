#!/bin/bash

# Fix Budget.category to Budget.categoryId references
echo "Fixing Budget.category to Budget.categoryId references..."

# Find all TypeScript/React files
find src -type f \( -name "*.ts" -o -name "*.tsx" \) | while read -r file; do
    # Check if file contains budget.category or budget?.category
    if grep -q "budget\(?\)\?\.category[^I]" "$file" 2>/dev/null; then
        echo "Processing: $file"

        # Create a backup
        cp "$file" "$file.bak"

        # Replace budget.category with budget.categoryId (but not budget.categoryId itself)
        sed -i '' 's/budget\.category\([^I]\)/budget.categoryId\1/g' "$file"
        sed -i '' 's/budget?\.category\([^I]\)/budget?.categoryId\1/g' "$file"

        # Also handle cases where it's at the end of line
        sed -i '' 's/budget\.category$/budget.categoryId/g' "$file"
        sed -i '' 's/budget?\.category$/budget?.categoryId/g' "$file"

        # Check if changes were made
        if diff -q "$file" "$file.bak" > /dev/null; then
            # No changes, remove backup
            rm "$file.bak"
        else
            echo "  Updated: $file"
            rm "$file.bak"
        fi
    fi
done

echo "Completed fixing Budget.category references"