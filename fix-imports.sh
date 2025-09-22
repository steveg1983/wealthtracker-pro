#!/bin/bash

echo "Fixing import paths..."

# 1. Remove imports for non-existent services
echo "Removing accessibilityDashboardService imports..."
find src/components -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '' '/import.*accessibilityDashboardService/d' {} \;

echo "Removing serviceFactory imports..."
find src -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '' '/import.*serviceFactory/d' {} \;

# 2. Fix loggingService imports (should use lazyLogger)
echo "Fixing loggingService imports..."
find src -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '' "s|import { logger } from '\.\./services/loggingService'|import { lazyLogger as logger } from '../services/serviceFactory'|g" {} \;
find src -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '' "s|import logger from '\.\./services/loggingService'|import { lazyLogger as logger } from '../services/serviceFactory'|g" {} \;

# 3. Fix logger usage in utils
echo "Fixing logger in utils..."
find src/utils -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' '/^[[:space:]]*logger\./d' {} \;

# 4. Comment out types from non-existent services
echo "Commenting out types from non-existent services..."
find src/components -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '' 's/^import type {.*} from.*accessibilityDashboardService.*$/\/\/ &/' {} \;

echo "Done fixing imports!"