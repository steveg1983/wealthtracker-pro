#!/bin/bash

# Script to help identify and report on large components for refactoring

echo "=== Large Component Analysis Tool ==="
echo "Finding components over 300 lines..."
echo

# Function to analyze a component
analyze_component() {
    local file="$1"
    local lines=$(wc -l < "$file")
    local component_name=$(basename "$file" .tsx)
    
    echo "📊 $component_name.tsx: $lines lines"
    
    # Extract key patterns to identify refactoring opportunities
    echo "   Potential extractions:"
    
    # Count inline functions
    local inline_funcs=$(grep -c "const.*= (" "$file" 2>/dev/null || echo 0)
    if [ $inline_funcs -gt 3 ]; then
        echo "   - $inline_funcs inline functions (can extract)"
    fi
    
    # Check for large render methods
    local jsx_lines=$(grep -c "return (" "$file" 2>/dev/null || echo 0)
    if [ $jsx_lines -gt 1 ]; then
        echo "   - Multiple render sections (can split)"
    fi
    
    # Check for form handling
    if grep -q "onSubmit\|handleSubmit" "$file" 2>/dev/null; then
        echo "   - Form logic (extract to custom hook)"
    fi
    
    # Check for data fetching
    if grep -q "useEffect.*fetch\|axios\|api" "$file" 2>/dev/null; then
        echo "   - Data fetching logic (extract to service)"
    fi
    
    # Check for complex state
    local state_count=$(grep -c "useState\|useReducer" "$file" 2>/dev/null || echo 0)
    if [ $state_count -gt 5 ]; then
        echo "   - $state_count state variables (consider context/reducer)"
    fi
    
    echo
}

# Find all components over 300 lines
echo "=== Components Over 800 Lines (Critical) ==="
find src -name "*.tsx" -type f -exec sh -c 'lines=$(wc -l < "$1"); [ $lines -gt 800 ] && echo "$lines $1"' _ {} \; | sort -rn | while read lines file; do
    analyze_component "$file"
done

echo "=== Components 500-800 Lines (High Priority) ==="
find src -name "*.tsx" -type f -exec sh -c 'lines=$(wc -l < "$1"); [ $lines -ge 500 ] && [ $lines -le 800 ] && echo "$lines $1"' _ {} \; | sort -rn | head -10 | while read lines file; do
    analyze_component "$file"
done

echo "=== Summary Statistics ==="
total_over_300=$(find src -name "*.tsx" -type f -exec sh -c 'lines=$(wc -l < "$1"); [ $lines -gt 300 ] && echo 1' _ {} \; | wc -l)
total_over_500=$(find src -name "*.tsx" -type f -exec sh -c 'lines=$(wc -l < "$1"); [ $lines -gt 500 ] && echo 1' _ {} \; | wc -l)
total_over_800=$(find src -name "*.tsx" -type f -exec sh -c 'lines=$(wc -l < "$1"); [ $lines -gt 800 ] && echo 1' _ {} \; | wc -l)

echo "Components over 300 lines: $total_over_300"
echo "Components over 500 lines: $total_over_500"
echo "Components over 800 lines: $total_over_800"

echo
echo "Recommended refactoring order:"
echo "1. Start with largest components (>800 lines)"
echo "2. Extract reusable hooks for state/logic"
echo "3. Split large forms into sub-components"
echo "4. Move business logic to services"
echo "5. Apply React.memo to all extracted components"