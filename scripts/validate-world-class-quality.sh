#!/bin/bash

# World-Class Quality Validator for WealthTracker
# Ensures components meet Apple/Google/Microsoft engineering standards

set -e

echo "🚀 World-Class Quality Validator"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
TOTAL_ISSUES=0
CRITICAL_ISSUES=0
COMPONENTS_CHECKED=0
PERFECT_COMPONENTS=0

# Function to check a component
check_component() {
    local file=$1
    local filename=$(basename "$file")
    local issues=0
    local critical=0
    
    COMPONENTS_CHECKED=$((COMPONENTS_CHECKED + 1))
    
    echo "Checking: $filename"
    
    # Check line count (should be under 200, ideally under 150)
    local lines=$(wc -l < "$file")
    if [ "$lines" -gt 300 ]; then
        echo -e "  ${RED}❌ CRITICAL: $lines lines (max 200 for world-class)${NC}"
        critical=$((critical + 1))
    elif [ "$lines" -gt 200 ]; then
        echo -e "  ${YELLOW}⚠️  WARNING: $lines lines (aim for <150)${NC}"
        issues=$((issues + 1))
    fi
    
    # Check for 'any' types (zero tolerance)
    local any_count=$(grep -c "\bany\b" "$file" || true)
    if [ "$any_count" -gt 0 ]; then
        echo -e "  ${RED}❌ CRITICAL: Found $any_count 'any' types (zero tolerance)${NC}"
        critical=$((critical + 1))
    fi
    
    # Check for console.log (should use logger)
    local console_count=$(grep -c "console\." "$file" || true)
    if [ "$console_count" -gt 0 ]; then
        echo -e "  ${YELLOW}⚠️  WARNING: Found $console_count console statements (use logger)${NC}"
        issues=$((issues + 1))
    fi
    
    # Check for error handling (minimum try-catch blocks)
    local try_count=$(grep -c "try\s*{" "$file" || true)
    local logger_count=$(grep -c "logger\." "$file" || true)
    
    if [ "$try_count" -eq 0 ] && [ "$lines" -gt 50 ]; then
        echo -e "  ${RED}❌ CRITICAL: No error handling (try-catch blocks)${NC}"
        critical=$((critical + 1))
    elif [ "$try_count" -lt 2 ] && [ "$lines" -gt 100 ]; then
        echo -e "  ${YELLOW}⚠️  WARNING: Minimal error handling ($try_count try-catch blocks)${NC}"
        issues=$((issues + 1))
    fi
    
    if [ "$logger_count" -eq 0 ] && [ "$lines" -gt 50 ]; then
        echo -e "  ${YELLOW}⚠️  WARNING: No logging found${NC}"
        issues=$((issues + 1))
    fi
    
    # Check for React.memo
    local memo_count=$(grep -c "memo(" "$file" || true)
    if [ "$memo_count" -eq 0 ] && [ "$lines" -gt 100 ]; then
        echo -e "  ${YELLOW}⚠️  WARNING: Not using React.memo for optimization${NC}"
        issues=$((issues + 1))
    fi
    
    # Check for proper exports
    local default_export=$(grep -c "^export default" "$file" || true)
    local named_export=$(grep -c "^export const.*= memo" "$file" || true)
    if [ "$default_export" -eq 0 ] && [ "$named_export" -eq 0 ]; then
        echo -e "  ${YELLOW}⚠️  WARNING: No proper export found${NC}"
        issues=$((issues + 1))
    fi
    
    # Check for useCallback/useMemo usage
    local callback_count=$(grep -c "useCallback" "$file" || true)
    local memo_hook_count=$(grep -c "useMemo" "$file" || true)
    if [ "$callback_count" -eq 0 ] && [ "$lines" -gt 100 ]; then
        echo -e "  ${YELLOW}⚠️  WARNING: Not using useCallback for optimization${NC}"
        issues=$((issues + 1))
    fi
    
    # Check for proper TypeScript types
    local interface_count=$(grep -c "interface\|type.*=" "$file" || true)
    if [ "$interface_count" -eq 0 ] && [ "$lines" -gt 50 ]; then
        echo -e "  ${YELLOW}⚠️  WARNING: No TypeScript interfaces/types defined${NC}"
        issues=$((issues + 1))
    fi
    
    # Update totals
    TOTAL_ISSUES=$((TOTAL_ISSUES + issues))
    CRITICAL_ISSUES=$((CRITICAL_ISSUES + critical))
    
    if [ "$issues" -eq 0 ] && [ "$critical" -eq 0 ]; then
        echo -e "  ${GREEN}✅ WORLD-CLASS: Perfect component!${NC}"
        PERFECT_COMPONENTS=$((PERFECT_COMPONENTS + 1))
    fi
    
    echo ""
}

# Check all component files
echo "Scanning component files..."
echo ""

# Main components
for file in src/components/*.tsx; do
    if [ -f "$file" ]; then
        check_component "$file"
    fi
done

# Sub-components in folders
for dir in src/components/*/; do
    if [ -d "$dir" ]; then
        for file in "$dir"*.tsx; do
            if [ -f "$file" ]; then
                check_component "$file"
            fi
        done
    fi
done

# Summary
echo "================================"
echo "QUALITY REPORT SUMMARY"
echo "================================"
echo ""
echo "Components Checked: $COMPONENTS_CHECKED"
echo -e "${GREEN}Perfect Components: $PERFECT_COMPONENTS${NC}"
echo -e "${YELLOW}Total Issues: $TOTAL_ISSUES${NC}"
echo -e "${RED}Critical Issues: $CRITICAL_ISSUES${NC}"
echo ""

# Calculate grade
if [ "$CRITICAL_ISSUES" -eq 0 ] && [ "$TOTAL_ISSUES" -eq 0 ]; then
    echo -e "${GREEN}🏆 GRADE: A+ (WORLD-CLASS)${NC}"
    echo "Your code meets Apple/Google/Microsoft standards!"
elif [ "$CRITICAL_ISSUES" -eq 0 ] && [ "$TOTAL_ISSUES" -lt 10 ]; then
    echo -e "${GREEN}✨ GRADE: A (EXCELLENT)${NC}"
    echo "Minor improvements needed for world-class status."
elif [ "$CRITICAL_ISSUES" -lt 5 ]; then
    echo -e "${YELLOW}⭐ GRADE: B (GOOD)${NC}"
    echo "Several improvements needed."
else
    echo -e "${RED}⚠️  GRADE: C (NEEDS WORK)${NC}"
    echo "Significant refactoring required for production quality."
fi

echo ""
echo "Run this script regularly to maintain world-class standards!"

# Exit with error if critical issues found
if [ "$CRITICAL_ISSUES" -gt 0 ]; then
    exit 1
fi

exit 0