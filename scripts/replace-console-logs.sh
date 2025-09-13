#!/bin/bash

# Script to replace console.log/error/warn with logger service calls
# This ensures consistent logging across the application

echo "🔄 Replacing console statements with logger service..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter for replacements
TOTAL_REPLACEMENTS=0

# Function to process a single file
process_file() {
    local file="$1"
    local temp_file="${file}.tmp"
    local replacements=0
    
    # Skip test files and setup files
    if [[ "$file" == *".test."* ]] || [[ "$file" == *"/test/"* ]] || [[ "$file" == *"setup"* ]]; then
        return 0
    fi
    
    # Skip the logging service itself
    if [[ "$file" == *"loggingService"* ]] || [[ "$file" == *"consoleToLogger"* ]]; then
        return 0
    fi
    
    # Check if file already imports logger
    has_logger_import=$(grep -c "import.*logger.*from.*loggingService" "$file" || echo 0)
    
    # Count console statements
    console_count=$(grep -c "console\.\(log\|error\|warn\|info\|debug\)" "$file" || echo 0)
    
    if [ $console_count -gt 0 ]; then
        echo "  Processing: $file (found $console_count console statements)"
        
        # Create a backup
        cp "$file" "${file}.bak"
        
        # Replace console statements
        sed -E \
            -e 's/console\.log/logger.debug/g' \
            -e 's/console\.error/logger.error/g' \
            -e 's/console\.warn/logger.warn/g' \
            -e 's/console\.info/logger.info/g' \
            -e 's/console\.debug/logger.debug/g' \
            "$file" > "$temp_file"
        
        # Add logger import if not present
        if [ $has_logger_import -eq 0 ]; then
            # Determine the correct import path based on file location
            if [[ "$file" == *"/services/"* ]]; then
                import_path="../loggingService"
            elif [[ "$file" == *"/components/"* ]]; then
                import_path="../services/loggingService"
            elif [[ "$file" == *"/hooks/"* ]]; then
                import_path="../services/loggingService"
            elif [[ "$file" == *"/utils/"* ]]; then
                import_path="../services/loggingService"
            elif [[ "$file" == *"/pages/"* ]]; then
                import_path="../services/loggingService"
            else
                import_path="./services/loggingService"
            fi
            
            # Add import after the first import statement or at the beginning
            if grep -q "^import" "$temp_file"; then
                # Find the last import line and add logger import after it
                awk -v import="import { logger } from '$import_path';" '
                    /^import/ { last_import=NR }
                    1
                    NR==last_import && !printed { print import; printed=1 }
                ' "$temp_file" > "${temp_file}.2"
                mv "${temp_file}.2" "$temp_file"
            else
                # Add at the beginning of the file
                echo "import { logger } from '$import_path';" | cat - "$temp_file" > "${temp_file}.2"
                mv "${temp_file}.2" "$temp_file"
            fi
        fi
        
        # Replace the original file
        mv "$temp_file" "$file"
        
        # Remove backup if successful
        rm "${file}.bak"
        
        replacements=$console_count
        TOTAL_REPLACEMENTS=$((TOTAL_REPLACEMENTS + replacements))
        
        echo -e "    ${GREEN}✓${NC} Replaced $replacements console statements"
    fi
}

# Process all TypeScript and JavaScript files in src directory
echo "Scanning for files with console statements..."

# Find all files with console statements (excluding tests and setup)
files=$(find src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
    -not -path "*/node_modules/*" \
    -not -path "*/__tests__/*" \
    -not -path "*/test/*" \
    -not -name "*.test.*" \
    -not -name "*loggingService*" \
    -not -name "*consoleToLogger*" \
    -exec grep -l "console\.\(log\|error\|warn\|info\|debug\)" {} \;)

file_count=$(echo "$files" | wc -l)
echo "Found $file_count files to process"
echo ""

# Process each file
for file in $files; do
    process_file "$file"
done

echo ""
echo -e "${GREEN}✅ Complete!${NC}"
echo "Total replacements: $TOTAL_REPLACEMENTS"
echo ""
echo "Note: Test files and setup files were skipped intentionally."
echo "The logging service itself was also skipped to avoid circular dependencies."