#!/bin/bash

# World-Class Refactoring Progress Tracker
# Monitors and reports on refactoring activities in real-time

echo "🔍 WealthTracker Refactoring Progress Tracker"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check file quality
check_file_quality() {
    local file=$1
    local issues=0
    local report=""
    
    # Check for any types
    if grep -q ": any" "$file" 2>/dev/null; then
        report="${report}  ❌ Contains 'any' types\n"
        ((issues++))
    fi
    
    # Check for console statements
    if grep -q "console\." "$file" 2>/dev/null; then
        report="${report}  ❌ Contains console statements\n"
        ((issues++))
    fi
    
    # Check for React.memo
    if ! grep -q "React.memo\|memo(" "$file" 2>/dev/null; then
        report="${report}  ⚠️  Missing React.memo\n"
        ((issues++))
    fi
    
    # Check for JSDoc
    if ! grep -q "@component\|@description" "$file" 2>/dev/null; then
        report="${report}  ⚠️  Missing JSDoc documentation\n"
        ((issues++))
    fi
    
    # Get line count
    lines=$(wc -l < "$file" 2>/dev/null)
    if [ "$lines" -gt 200 ]; then
        report="${report}  ⚠️  File too large: ${lines} lines (max: 200)\n"
        ((issues++))
    fi
    
    echo "$issues|$report"
}

# 1. Find all refactored components
echo -e "${BLUE}📁 REFACTORED COMPONENTS${NC}"
echo "------------------------"
refactored_files=$(find src/components -name "*-refactored.tsx" -type f 2>/dev/null | sort)
refactored_count=$(echo "$refactored_files" | wc -l)

echo -e "Found ${GREEN}${refactored_count}${NC} refactored components"
echo ""

# 2. Check recent refactoring activity (last 24 hours)
echo -e "${BLUE}🕐 RECENT REFACTORING ACTIVITY (Last 24 hours)${NC}"
echo "----------------------------------------------"
recent_files=$(find src/components -name "*-refactored.tsx" -type f -mtime -1 2>/dev/null | sort)

if [ -z "$recent_files" ]; then
    echo "No refactoring activity in the last 24 hours"
else
    echo "$recent_files" | while read -r file; do
        timestamp=$(date -r "$file" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$file" 2>/dev/null)
        echo -e "${GREEN}✓${NC} $(basename "$file") - Modified: $timestamp"
    done
fi
echo ""

# 3. Quality audit of refactored files
echo -e "${BLUE}🏆 QUALITY AUDIT OF REFACTORED FILES${NC}"
echo "-------------------------------------"

total_issues=0
files_with_issues=0
perfect_files=0

echo "$refactored_files" | while read -r file; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        result=$(check_file_quality "$file")
        issues=$(echo "$result" | cut -d'|' -f1)
        report=$(echo "$result" | cut -d'|' -f2)
        
        if [ "$issues" -eq 0 ]; then
            echo -e "${GREEN}✅ $filename${NC} - EXCELLENT"
            ((perfect_files++))
        else
            echo -e "${YELLOW}⚠️  $filename${NC} - $issues issues found:"
            echo -e "$report"
            ((files_with_issues++))
            ((total_issues+=issues))
        fi
    fi
done

echo ""

# 4. Files that need excellence review
echo -e "${BLUE}🔧 FILES NEEDING EXCELLENCE REVIEW${NC}"
echo "-----------------------------------"

needs_review=$(find src/components -name "*-refactored.tsx" -type f -exec sh -c '
    grep -l ": any" "$1" 2>/dev/null || 
    grep -l "console\." "$1" 2>/dev/null ||
    [ $(wc -l < "$1") -gt 200 ] && echo "$1"
' _ {} \; 2>/dev/null | sort -u)

if [ -z "$needs_review" ]; then
    echo -e "${GREEN}All refactored files meet excellence standards!${NC}"
else
    echo "$needs_review" | while read -r file; do
        echo -e "${RED}➤${NC} $(basename "$file")"
    done
fi
echo ""

# 5. Git status of refactored files
echo -e "${BLUE}📊 GIT STATUS OF REFACTORED FILES${NC}"
echo "----------------------------------"

# Check which refactored files are staged/modified
staged_count=0
modified_count=0
untracked_count=0

echo "$refactored_files" | while read -r file; do
    if [ -f "$file" ]; then
        git_status=$(git status --porcelain "$file" 2>/dev/null | cut -c1-2)
        
        case "$git_status" in
            "M ")
                echo -e "${GREEN}Staged:${NC} $(basename "$file")"
                ((staged_count++))
                ;;
            " M")
                echo -e "${YELLOW}Modified:${NC} $(basename "$file")"
                ((modified_count++))
                ;;
            "??")
                echo -e "${RED}Untracked:${NC} $(basename "$file")"
                ((untracked_count++))
                ;;
        esac
    fi
done
echo ""

# 6. Summary statistics
echo -e "${BLUE}📈 SUMMARY STATISTICS${NC}"
echo "---------------------"
echo -e "Total Refactored Components: ${GREEN}$refactored_count${NC}"
echo -e "Perfect Components: ${GREEN}$perfect_files${NC}"
echo -e "Components Needing Review: ${YELLOW}$files_with_issues${NC}"
echo -e "Total Issues Found: ${RED}$total_issues${NC}"
echo ""

# 7. Next actions
echo -e "${BLUE}🎯 RECOMMENDED NEXT ACTIONS${NC}"
echo "---------------------------"

if [ "$total_issues" -gt 0 ]; then
    echo "1. Fix 'any' types in affected components"
    echo "2. Add missing React.memo wrappers"
    echo "3. Add comprehensive JSDoc documentation"
    echo "4. Split components larger than 200 lines"
    echo "5. Remove console statements"
else
    echo -e "${GREEN}All refactored components meet excellence standards!${NC}"
    echo "Continue monitoring for new refactoring activity."
fi

# 8. Generate tracking report
report_file="REFACTORING_TRACKING_$(date +%Y%m%d_%H%M%S).md"
echo ""
echo -e "${BLUE}📝 Generating detailed report: ${report_file}${NC}"

cat > "$report_file" << EOF
# Refactoring Progress Tracking Report
Generated: $(date)

## Summary
- Total Refactored Components: $refactored_count
- Perfect Components: $perfect_files
- Components Needing Review: $files_with_issues
- Total Issues Found: $total_issues

## Refactored Files
$(echo "$refactored_files" | while read -r file; do
    echo "- $(basename "$file")"
done)

## Quality Issues
$(echo "$needs_review" | while read -r file; do
    if [ -n "$file" ]; then
        echo "### $(basename "$file")"
        grep -n ": any" "$file" 2>/dev/null | head -3 | sed 's/^/- Line /'
        grep -n "console\." "$file" 2>/dev/null | head -3 | sed 's/^/- Line /'
    fi
done)

## Next Actions
1. Review and fix identified issues
2. Apply excellence standards to all components
3. Add performance monitoring to refactored components
4. Ensure error boundaries are in place
EOF

echo -e "${GREEN}✓ Report generated successfully${NC}"