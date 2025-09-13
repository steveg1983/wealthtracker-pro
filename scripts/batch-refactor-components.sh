#!/bin/bash

# Batch refactor script to quickly apply common extraction patterns

echo "=== Batch Component Refactoring Tool ==="
echo

# Function to add React.memo to components that don't have it
add_memo_to_components() {
    echo "Adding React.memo to components..."
    
    # Find all components without memo
    for file in src/components/**/*.tsx src/pages/**/*.tsx; do
        if [ -f "$file" ]; then
            # Check if file doesn't already use memo
            if ! grep -q "memo(" "$file" && grep -q "export default function\|export function" "$file"; then
                component_name=$(basename "$file" .tsx)
                echo "  Adding memo to $component_name"
                
                # Add memo import if not present
                if ! grep -q "import.*memo.*from 'react'" "$file"; then
                    sed -i '' "s/import React.*from 'react'/import React, { memo } from 'react'/" "$file" 2>/dev/null || true
                fi
                
                # Wrap default export with memo
                sed -i '' "s/export default function \([^(]*\)/const \1 = memo(function \1/" "$file" 2>/dev/null || true
                sed -i '' "$ a\\
export default $component_name;" "$file" 2>/dev/null || true
            fi
        fi
    done
}

# Function to extract large useEffect blocks into custom hooks
extract_effects_to_hooks() {
    echo "Extracting useEffect blocks to custom hooks..."
    
    for file in src/components/**/*.tsx src/pages/**/*.tsx; do
        if [ -f "$file" ]; then
            effect_count=$(grep -c "useEffect" "$file" 2>/dev/null || echo 0)
            if [ $effect_count -gt 3 ]; then
                component_name=$(basename "$file" .tsx)
                echo "  $component_name has $effect_count useEffect calls - consider extracting to hooks"
            fi
        fi
    done
}

# Function to identify components with too many props (>5)
check_component_props() {
    echo "Checking for components with too many props..."
    
    for file in src/components/**/*.tsx src/pages/**/*.tsx; do
        if [ -f "$file" ]; then
            # Look for interface definitions with many properties
            if grep -q "interface.*Props {" "$file"; then
                component_name=$(basename "$file" .tsx)
                # Count properties in Props interface (rough estimate)
                prop_count=$(awk '/interface.*Props {/,/^}/' "$file" | grep -c ":" 2>/dev/null || echo 0)
                if [ $prop_count -gt 5 ]; then
                    echo "  $component_name has ~$prop_count props - consider composition"
                fi
            fi
        fi
    done
}

# Function to find and report console.log statements
find_console_logs() {
    echo "Finding remaining console.log statements..."
    
    count=0
    for file in src/**/*.ts src/**/*.tsx; do
        if [ -f "$file" ]; then
            logs=$(grep -n "console\.\(log\|error\|warn\|debug\)" "$file" 2>/dev/null || true)
            if [ ! -z "$logs" ]; then
                component_name=$(basename "$file")
                echo "  Found in $component_name"
                count=$((count+1))
            fi
        fi
    done
    echo "  Total files with console statements: $count"
}

# Function to add loading states to async components
add_loading_states() {
    echo "Checking for missing loading states..."
    
    for file in src/components/**/*.tsx src/pages/**/*.tsx; do
        if [ -f "$file" ]; then
            # Check if component uses async data but no loading state
            if grep -q "async\|fetch\|await" "$file" && ! grep -q "loading\|isLoading\|pending" "$file"; then
                component_name=$(basename "$file" .tsx)
                echo "  $component_name uses async but may lack loading state"
            fi
        fi
    done
}

# Main execution
echo "1. Component Memoization Check"
echo "==============================="
total_components=$(find src -name "*.tsx" -type f | wc -l)
memoized=$(grep -l "memo(" src/**/*.tsx 2>/dev/null | wc -l)
echo "Total components: $total_components"
echo "Memoized components: $memoized"
echo "Percentage memoized: $((memoized * 100 / total_components))%"
echo

echo "2. Console Statement Audit"
echo "=========================="
find_console_logs
echo

echo "3. Effect Hook Analysis"
echo "======================="
extract_effects_to_hooks | head -10
echo

echo "4. Props Complexity Check"
echo "========================"
check_component_props | head -10
echo

echo "5. Async/Loading State Check"
echo "==========================="
add_loading_states | head -10
echo

echo "=== Quick Win Opportunities ==="
echo "1. Run: npm run lint to find all lint issues"
echo "2. Add React.memo to $(($total_components - $memoized)) components"
echo "3. Replace console.logs with logger service"
echo "4. Extract complex useEffect logic to custom hooks"
echo "5. Split components with >5 props into smaller parts"