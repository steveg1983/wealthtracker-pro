#!/bin/bash

# Automatically add React.memo to all components

echo "=== Auto-adding React.memo to Components ==="
echo

success_count=0
skip_count=0
error_count=0

# Process each tsx file
for file in $(find src -name "*.tsx" -type f | grep -v ".test.tsx" | grep -v ".stories.tsx"); do
    component_name=$(basename "$file" .tsx)
    
    # Skip if already has memo
    if grep -q "memo(" "$file"; then
        skip_count=$((skip_count + 1))
        continue
    fi
    
    # Skip if it's a type definition file
    if grep -q "^export type\|^export interface" "$file" && ! grep -q "export default function\|export const.*=.*function\|export function" "$file"; then
        skip_count=$((skip_count + 1))
        continue
    fi
    
    # Process files with default function exports
    if grep -q "export default function" "$file"; then
        echo "Processing: $component_name"
        
        # Create temp file
        temp_file="${file}.tmp"
        
        # Add memo import if needed
        if ! grep -q "import.*{.*memo" "$file"; then
            # Check if React import exists
            if grep -q "^import React" "$file"; then
                sed 's/^import React/import React, { memo }/' "$file" > "$temp_file"
            else
                echo "import { memo } from 'react';" > "$temp_file"
                cat "$file" >> "$temp_file"
            fi
        else
            cp "$file" "$temp_file"
        fi
        
        # Replace export default function with memo wrapped version
        sed -i '' "s/export default function \([^(]*\)(/const \1 = memo(function \1(/" "$temp_file"
        
        # Add export default at the end
        echo "" >> "$temp_file"
        echo "export default $component_name;" >> "$temp_file"
        
        # Replace original file
        mv "$temp_file" "$file"
        success_count=$((success_count + 1))
        
    # Process named function exports  
    elif grep -q "export function" "$file"; then
        echo "Processing named export: $component_name"
        
        # Extract function name
        func_name=$(grep "export function" "$file" | head -1 | sed 's/export function \([^(]*\).*/\1/')
        
        # Create temp file
        temp_file="${file}.tmp"
        
        # Add memo import if needed
        if ! grep -q "import.*{.*memo" "$file"; then
            if grep -q "^import React" "$file"; then
                sed 's/^import React/import React, { memo }/' "$file" > "$temp_file"
            else
                echo "import { memo } from 'react';" > "$temp_file"
                cat "$file" >> "$temp_file"
            fi
        else
            cp "$file" "$temp_file"
        fi
        
        # Wrap with memo
        sed -i '' "s/export function \([^(]*\)(/export const \1 = memo(function \1(/" "$temp_file"
        
        # Close the memo wrapper
        echo ");" >> "$temp_file"
        
        mv "$temp_file" "$file"
        success_count=$((success_count + 1))
        
    # Process arrow function components
    elif grep -q "export const.*=.*() =>" "$file" || grep -q "export const.*=.*props =>" "$file"; then
        echo "Processing arrow function: $component_name"
        
        # Get component name from export
        comp_name=$(grep "export const" "$file" | head -1 | sed 's/export const \([^:= ]*\).*/\1/')
        
        if [ ! -z "$comp_name" ]; then
            # Create temp file
            temp_file="${file}.tmp"
            
            # Add memo import if needed
            if ! grep -q "import.*{.*memo" "$file"; then
                if grep -q "^import React" "$file"; then
                    sed 's/^import React/import React, { memo }/' "$file" > "$temp_file"
                else
                    echo "import { memo } from 'react';" > "$temp_file"
                    cat "$file" >> "$temp_file"
                fi
            else
                cp "$file" "$temp_file"
            fi
            
            # Wrap with memo
            sed -i '' "s/export const \($comp_name\)/export const \1 = memo(\1_base);\nconst \1_base/" "$temp_file"
            
            mv "$temp_file" "$file"
            success_count=$((success_count + 1))
        else
            error_count=$((error_count + 1))
        fi
    else
        skip_count=$((skip_count + 1))
    fi
done

echo
echo "=== Summary ==="
echo "✅ Successfully memoized: $success_count components"
echo "⏭️  Skipped: $skip_count files"
echo "❌ Errors: $error_count files"
echo
echo "Total components now memoized: $(grep -l "memo(" src/**/*.tsx 2>/dev/null | wc -l)"