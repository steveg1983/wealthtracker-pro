#!/bin/bash

# Automated Component Refactoring Helper
# This script creates the boilerplate for refactoring a component

COMPONENT_NAME=$1
COMPONENT_PATH=$2

if [ -z "$COMPONENT_NAME" ] || [ -z "$COMPONENT_PATH" ]; then
  echo "Usage: ./auto-refactor-component.sh ComponentName path/to/component.tsx"
  exit 1
fi

# Extract component base name (without .tsx)
BASE_NAME=$(basename "$COMPONENT_PATH" .tsx)
DIR_NAME=$(dirname "$COMPONENT_PATH")

# Create service file
SERVICE_NAME="${BASE_NAME}Service"
SERVICE_PATH="src/services/${BASE_NAME}Service.ts"

echo "Creating service: $SERVICE_PATH"
cat > "$SERVICE_PATH" << EOF
/**
 * Service for ${BASE_NAME} operations
 */
export class ${SERVICE_NAME} {
  // Add service methods here
  static method1() {
    // Business logic
  }

  static method2() {
    // Calculations
  }
}
EOF

# Create sub-components directory
SUB_DIR="${DIR_NAME}/${BASE_NAME}-components"
mkdir -p "$SUB_DIR"

echo "Creating sub-components directory: $SUB_DIR"

# Create refactored component template
REFACTORED_PATH="${DIR_NAME}/${BASE_NAME}-refactored.tsx"
echo "Creating refactored component: $REFACTORED_PATH"

cat > "$REFACTORED_PATH" << EOF
import { memo, useState, useCallback, useMemo } from 'react';
import { ${SERVICE_NAME} } from '../services/${BASE_NAME}Service';

/**
 * ${BASE_NAME} component - Refactored version
 * [Description]
 * Reduced from XXX lines to under 200 lines
 */
export const ${BASE_NAME} = memo(function ${BASE_NAME}(props: any) {
  // State management
  const [state, setState] = useState();

  // Memoized values
  const computed = useMemo(() => {
    return ${SERVICE_NAME}.method1();
  }, []);

  // Callbacks
  const handleAction = useCallback(() => {
    ${SERVICE_NAME}.method2();
  }, []);

  return (
    <div>
      {/* Refactored component JSX */}
    </div>
  );
});

export default ${BASE_NAME};
EOF

echo "✅ Refactoring boilerplate created for ${BASE_NAME}"
echo "Next steps:"
echo "1. Move business logic to $SERVICE_PATH"
echo "2. Extract sub-components to $SUB_DIR"
echo "3. Update the refactored component at $REFACTORED_PATH"
echo "4. Apply React.memo, useCallback, and useMemo"
echo "5. Ensure component is under 300 lines"