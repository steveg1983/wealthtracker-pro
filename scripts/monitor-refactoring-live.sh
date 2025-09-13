#!/bin/bash

# Live Refactoring Monitor
# Watches for changes and alerts on new refactoring activity

echo "🔴 LIVE REFACTORING MONITOR"
echo "============================"
echo "Monitoring for refactoring changes..."
echo "Press Ctrl+C to stop"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Store initial state
initial_files=$(find src/components -name "*-refactored.tsx" -type f 2>/dev/null | sort)
echo "$initial_files" > /tmp/refactored_files_baseline.txt

# Function to check new file
check_new_file() {
    local file=$1
    echo -e "\n${GREEN}🆕 NEW REFACTORED FILE DETECTED!${NC}"
    echo "File: $file"
    echo "Time: $(date '+%H:%M:%S')"
    
    # Quick quality check
    echo -e "\n${YELLOW}Quick Quality Check:${NC}"
    
    # Check for any types
    if grep -q ": any" "$file" 2>/dev/null; then
        echo -e "  ${RED}❌ Contains 'any' types - NEEDS FIX${NC}"
        grep -n ": any" "$file" 2>/dev/null | head -2
    else
        echo -e "  ${GREEN}✓ No 'any' types${NC}"
    fi
    
    # Check for console
    if grep -q "console\." "$file" 2>/dev/null; then
        echo -e "  ${RED}❌ Contains console statements - NEEDS FIX${NC}"
    else
        echo -e "  ${GREEN}✓ No console statements${NC}"
    fi
    
    # Check size
    lines=$(wc -l < "$file" 2>/dev/null)
    if [ "$lines" -gt 200 ]; then
        echo -e "  ${YELLOW}⚠️  Large file: $lines lines${NC}"
    else
        echo -e "  ${GREEN}✓ Good size: $lines lines${NC}"
    fi
    
    # Check for memo
    if grep -q "React.memo\|memo(" "$file" 2>/dev/null; then
        echo -e "  ${GREEN}✓ Uses React.memo${NC}"
    else
        echo -e "  ${YELLOW}⚠️  Missing React.memo${NC}"
    fi
    
    echo -e "\n${BLUE}Action Required:${NC} Review and apply excellence standards"
    echo "----------------------------------------"
}

# Function to check modified file
check_modified_file() {
    local file=$1
    echo -e "\n${YELLOW}📝 REFACTORED FILE MODIFIED${NC}"
    echo "File: $file"
    echo "Time: $(date '+%H:%M:%S')"
    echo "Git diff preview:"
    git diff --stat "$file" 2>/dev/null | head -5
    echo "----------------------------------------"
}

# Monitor loop
while true; do
    # Check for new refactored files
    current_files=$(find src/components -name "*-refactored.tsx" -type f 2>/dev/null | sort)
    
    # Find new files
    new_files=$(comm -13 <(echo "$initial_files") <(echo "$current_files"))
    
    if [ -n "$new_files" ]; then
        echo "$new_files" | while read -r file; do
            check_new_file "$file"
        done
        # Update baseline
        initial_files="$current_files"
    fi
    
    # Check for modifications to existing refactored files
    echo "$current_files" | while read -r file; do
        if [ -f "$file" ]; then
            # Check if file was modified in last 60 seconds
            if [ "$(find "$file" -mmin -1 2>/dev/null)" ]; then
                check_modified_file "$file"
            fi
        fi
    done
    
    # Sleep for 5 seconds before next check
    sleep 5
done