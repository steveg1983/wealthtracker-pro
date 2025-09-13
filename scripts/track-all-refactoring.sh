#!/bin/bash

# Enhanced Refactoring Progress Tracker
# Detects both -refactored files AND in-place refactoring with backups

echo "🔍 WealthTracker Complete Refactoring Progress Tracker"
echo "======================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to check file quality
check_file_quality() {
    local file=$1
    local issues=0
    local report=""
    
    # Check for any types
    any_count=$(grep -c ": any" "$file" 2>/dev/null || echo "0")
    if [ "$any_count" -gt 0 ]; then
        report="${report}  ❌ Contains ${any_count} 'any' types\n"
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
    if [ "$lines" -gt 300 ]; then
        report="${report}  ⚠️  File too large: ${lines} lines (consider splitting)\n"
        ((issues++))
    fi
    
    echo "$issues|$report"
}

echo -e "${BLUE}📁 REFACTORING DETECTION METHODS${NC}"
echo "-----------------------------------"

# Method 1: Files with -refactored suffix
echo -e "${CYAN}Method 1: Files with -refactored suffix${NC}"
refactored_files=$(find src/components -name "*-refactored.tsx" -o -name "*-refactored.ts" 2>/dev/null | sort)
refactored_count=$(echo "$refactored_files" | grep -c "refactored" 2>/dev/null || echo "0")
echo "Found ${GREEN}$refactored_count${NC} components with -refactored suffix"
echo ""

# Method 2: Files with .backup versions (in-place refactoring)
echo -e "${CYAN}Method 2: In-place refactored files (have .backup)${NC}"
backup_files=$(find src/components -name "*.backup.tsx" -o -name "*.backup.ts" 2>/dev/null)
inplace_refactored=""
for backup in $backup_files; do
    original="${backup%.backup.tsx}.tsx"
    if [ -f "$original" ]; then
        # Check if the original was modified after the backup was created
        if [ "$original" -nt "$backup" ]; then
            inplace_refactored="$inplace_refactored$original\n"
        fi
    fi
done
inplace_count=$(echo -e "$inplace_refactored" | grep -c "\.tsx" 2>/dev/null || echo "0")
echo "Found ${GREEN}$inplace_count${NC} components refactored in-place"
echo ""

# Method 3: Recently modified files (last 24 hours) that might be refactored
echo -e "${CYAN}Method 3: Recently modified components (last 24 hours)${NC}"
recent_files=$(find src/components -name "*.tsx" -mtime -1 ! -name "*-refactored.tsx" ! -name "*.backup.tsx" ! -name "*.test.tsx" 2>/dev/null | sort)
recent_count=$(echo "$recent_files" | grep -c "\.tsx" 2>/dev/null || echo "0")
echo "Found ${GREEN}$recent_count${NC} recently modified components"
echo ""

echo -e "${BLUE}🏆 QUALITY AUDIT - REFACTORED FILES${NC}"
echo "-------------------------------------"

# Check quality of -refactored files
if [ ! -z "$refactored_files" ]; then
    echo -e "${YELLOW}Files with -refactored suffix:${NC}"
    for file in $refactored_files; do
        if [ -f "$file" ]; then
            filename=$(basename "$file")
            quality_check=$(check_file_quality "$file")
            issues=$(echo "$quality_check" | cut -d'|' -f1)
            report=$(echo "$quality_check" | cut -d'|' -f2)
            
            if [ "$issues" -eq 0 ]; then
                echo -e "${GREEN}✅ $filename${NC} - EXCELLENT"
            else
                echo -e "${YELLOW}⚠️  $filename${NC} - $issues issues found:"
                echo -e "$report"
            fi
        fi
    done
    echo ""
fi

# Check quality of in-place refactored files
if [ ! -z "$inplace_refactored" ]; then
    echo -e "${YELLOW}In-place refactored files:${NC}"
    echo -e "$inplace_refactored" | while read -r file; do
        if [ -f "$file" ] && [ ! -z "$file" ]; then
            filename=$(basename "$file")
            quality_check=$(check_file_quality "$file")
            issues=$(echo "$quality_check" | cut -d'|' -f1)
            report=$(echo "$quality_check" | cut -d'|' -f2)
            
            if [ "$issues" -eq 0 ]; then
                echo -e "${GREEN}✅ $filename${NC} - EXCELLENT"
            else
                echo -e "${RED}❌ $filename${NC} - $issues issues found:"
                echo -e "$report"
            fi
        fi
    done
    echo ""
fi

# Summary statistics
echo -e "${BLUE}📊 SUMMARY STATISTICS${NC}"
echo "---------------------"
total_refactored=$((refactored_count + inplace_count))
echo "Total Refactored Components: ${GREEN}$total_refactored${NC}"
echo "  - With -refactored suffix: $refactored_count"
echo "  - Refactored in-place: $inplace_count"
echo ""

# List files needing excellence treatment
echo -e "${BLUE}🎯 FILES NEEDING EXCELLENCE TREATMENT${NC}"
echo "--------------------------------------"
needs_treatment=""
treatment_count=0

# Check in-place refactored files for missing excellence
echo -e "$inplace_refactored" | while read -r file; do
    if [ -f "$file" ] && [ ! -z "$file" ]; then
        needs_excellence=false
        
        # Check for any types
        if grep -q ": any" "$file" 2>/dev/null; then
            needs_excellence=true
        fi
        
        # Check for missing React.memo
        if ! grep -q "React.memo\|memo(" "$file" 2>/dev/null; then
            needs_excellence=true
        fi
        
        # Check for missing JSDoc
        if ! grep -q "@component\|@description" "$file" 2>/dev/null; then
            needs_excellence=true
        fi
        
        if [ "$needs_excellence" = true ]; then
            filename=$(basename "$file")
            echo -e "${RED}➤${NC} $filename"
            ((treatment_count++))
        fi
    fi
done

if [ "$treatment_count" -eq 0 ]; then
    echo -e "${GREEN}All refactored components meet excellence standards!${NC}"
fi

echo ""
echo -e "${BLUE}📝 Report generated at: $(date '+%Y-%m-%d %H:%M:%S')${NC}"