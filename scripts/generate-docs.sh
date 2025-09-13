#!/bin/bash

# Documentation Generation Script
# Generates comprehensive documentation for components, services, and hooks

echo "🚀 Starting documentation generation..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_FILES=0
DOCUMENTED_FILES=0
UNDOCUMENTED_FILES=0

# Create docs directory structure
mkdir -p docs/{components,services,hooks,generated}

echo -e "${BLUE}📊 Analyzing codebase documentation status...${NC}"

# Function to check if file has proper JSDoc
check_documentation() {
    local file="$1"
    local type="$2"
    
    TOTAL_FILES=$((TOTAL_FILES + 1))
    
    # Check for proper JSDoc header based on type
    case $type in
        "component")
            if grep -q "@component" "$file" && grep -q "@description" "$file" && grep -q "@example" "$file"; then
                DOCUMENTED_FILES=$((DOCUMENTED_FILES + 1))
                echo -e "${GREEN}✓${NC} $file"
                return 0
            fi
            ;;
        "service")
            if grep -q "@service" "$file" && grep -q "@description" "$file" && grep -q "@example" "$file"; then
                DOCUMENTED_FILES=$((DOCUMENTED_FILES + 1))
                echo -e "${GREEN}✓${NC} $file"
                return 0
            fi
            ;;
        "hook")
            if grep -q "@hook" "$file" && grep -q "@description" "$file" && grep -q "@example" "$file"; then
                DOCUMENTED_FILES=$((DOCUMENTED_FILES + 1))
                echo -e "${GREEN}✓${NC} $file"
                return 0
            fi
            ;;
    esac
    
    UNDOCUMENTED_FILES=$((UNDOCUMENTED_FILES + 1))
    echo -e "${RED}✗${NC} $file"
    return 1
}

# Generate skeleton JSDoc for undocumented files
generate_skeleton() {
    local file="$1"
    local type="$2"
    local basename=$(basename "$file" .tsx)
    basename=$(basename "$basename" .ts)
    
    case $type in
        "component")
            cat > "/tmp/jsdoc_skeleton" << EOF
/**
 * @component $basename
 * @description TODO: Add component description
 * 
 * @example
 * \`\`\`tsx
 * <$basename />
 * \`\`\`
 * 
 * @param {Props} props - Component properties
 * 
 * @returns {React.JSX.Element} TODO: Describe what this component renders
 * 
 * @features
 * - TODO: List key features
 * 
 * @performance
 * - TODO: Document performance optimizations
 * 
 * @accessibility
 * - TODO: Document accessibility features
 * 
 * @testing Coverage: TODO%
 * @security TODO: Document security considerations
 * 
 * @since TODO: Version when added
 * @author WealthTracker Team
 */

EOF
            ;;
        "service")
            cat > "/tmp/jsdoc_skeleton" << EOF
/**
 * @service $basename
 * @description TODO: Add service description
 * 
 * @example
 * \`\`\`typescript
 * import { $basename } from './$basename';
 * 
 * const result = await $basename.methodName();
 * \`\`\`
 * 
 * @features
 * - TODO: List service capabilities
 * 
 * @performance
 * - TODO: Document performance characteristics
 * 
 * @security
 * - TODO: Document security measures
 * 
 * @error-handling
 * - TODO: Document error handling strategy
 * 
 * @testing Coverage: TODO%
 * @dependencies TODO: List external dependencies
 * 
 * @since TODO: Version when added
 * @author WealthTracker Team
 */

EOF
            ;;
        "hook")
            cat > "/tmp/jsdoc_skeleton" << EOF
/**
 * @hook $basename
 * @description TODO: Add hook description
 * 
 * @example
 * \`\`\`typescript
 * const { data, loading } = $basename();
 * \`\`\`
 * 
 * @param {object} [options] - Hook configuration options
 * 
 * @returns {object} Hook return value
 * @returns {any} returns.data - TODO: Describe data
 * @returns {boolean} returns.loading - Loading state
 * 
 * @features
 * - TODO: List hook capabilities
 * 
 * @performance
 * - TODO: Document performance optimizations
 * 
 * @dependencies
 * - TODO: List hook dependencies
 * 
 * @testing Coverage: TODO%
 * 
 * @since TODO: Version when added
 * @author WealthTracker Team
 */

EOF
            ;;
    esac
    
    echo "Generated skeleton JSDoc for $file"
}

# Check components
echo -e "${YELLOW}📦 Checking components...${NC}"
find src/components -name "*.tsx" -type f | while read file; do
    check_documentation "$file" "component"
done

# Check services  
echo -e "${YELLOW}🔧 Checking services...${NC}"
find src/services -name "*.ts" -type f | while read file; do
    check_documentation "$file" "service"
done

# Check hooks
echo -e "${YELLOW}🪝 Checking hooks...${NC}"
find src/hooks -name "*.ts" -type f | while read file; do
    check_documentation "$file" "hook"
done

# Generate documentation report
cat > "docs/generated/documentation-report.md" << EOF
# Documentation Status Report

Generated: $(date)

## Summary

- **Total Files**: $TOTAL_FILES
- **Documented**: $DOCUMENTED_FILES
- **Undocumented**: $UNDOCUMENTED_FILES
- **Coverage**: $(echo "scale=1; $DOCUMENTED_FILES * 100 / $TOTAL_FILES" | bc)%

## Progress Toward World-Class

See PROJECT_ENTERPRISE.md for documentation standards; target comprehensive coverage.

Current Status: **$(echo "scale=1; $DOCUMENTED_FILES * 100 / $TOTAL_FILES" | bc)%** complete

## Next Steps

1. Add JSDoc to undocumented files
2. Ensure all JSDoc includes required sections
3. Add realistic examples to all documentation
4. Validate documentation quality
5. Generate API documentation site

## World-Class Requirements Met

- [ ] 100% JSDoc coverage
- [ ] All components documented
- [ ] All services documented  
- [ ] All hooks documented
- [ ] Examples provided for all public APIs
- [ ] Performance notes included
- [ ] Security considerations documented
- [ ] Testing coverage noted

EOF

echo -e "${BLUE}📋 Documentation report generated: docs/generated/documentation-report.md${NC}"

# Generate list of files that need documentation
echo -e "${YELLOW}📝 Generating TODO list for undocumented files...${NC}"

cat > "docs/generated/documentation-todo.md" << EOF
# Documentation TODO List

Files that need JSDoc documentation:

## Components

EOF

find src/components -name "*.tsx" -type f | while read file; do
    if ! check_documentation "$file" "component" >/dev/null 2>&1; then
        echo "- [ ] $file" >> "docs/generated/documentation-todo.md"
    fi
done

echo -e "\n## Services\n" >> "docs/generated/documentation-todo.md"

find src/services -name "*.ts" -type f | while read file; do
    if ! check_documentation "$file" "service" >/dev/null 2>&1; then
        echo "- [ ] $file" >> "docs/generated/documentation-todo.md"
    fi
done

echo -e "\n## Hooks\n" >> "docs/generated/documentation-todo.md"

find src/hooks -name "*.ts" -type f | while read file; do
    if ! check_documentation "$file" "hook" >/dev/null 2>&1; then
        echo "- [ ] $file" >> "docs/generated/documentation-todo.md"
    fi
done

echo -e "${GREEN}✅ Documentation analysis complete!${NC}"
echo -e "${BLUE}📊 See docs/generated/documentation-report.md for full report${NC}"
echo -e "${BLUE}📝 See docs/generated/documentation-todo.md for TODO list${NC}"

# Summary
echo -e "${YELLOW}📈 SUMMARY:${NC}"
echo -e "Total Files: $TOTAL_FILES"
echo -e "Documented: ${GREEN}$DOCUMENTED_FILES${NC}"
echo -e "Undocumented: ${RED}$UNDOCUMENTED_FILES${NC}"
if [ $TOTAL_FILES -gt 0 ]; then
    PERCENTAGE=$(echo "scale=1; $DOCUMENTED_FILES * 100 / $TOTAL_FILES" | bc)
    echo -e "Coverage: ${BLUE}$PERCENTAGE%${NC}"
else
    echo -e "Coverage: ${BLUE}0%${NC}"
fi
