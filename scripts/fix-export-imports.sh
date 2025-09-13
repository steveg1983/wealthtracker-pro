#!/bin/bash

# Fix all exportService imports to use the new unified export service

echo "🔄 Updating exportService imports..."

# Fix imports in components
sed -i '' "s/import { exportService } from '..\/services\/exportService'/import { exportData, downloadExport, ExportHelpers } from '..\/services\/export'/g" src/components/*.tsx
sed -i '' "s/import { exportService } from '..\/..\/services\/exportService'/import { exportData, downloadExport, ExportHelpers } from '..\/..\/services\/export'/g" src/components/**/*.tsx

# Fix type imports
sed -i '' "s/import type { ExportOptions, ExportTemplate } from '..\/services\/exportService'/import type { ExportOptions } from '..\/services\/export'/g" src/components/*.tsx
sed -i '' "s/import type { ExportOptions, ExportTemplate, ScheduledReport } from '..\/services\/exportService'/import type { ExportOptions } from '..\/services\/export'/g" src/pages/*.tsx

# Fix service imports
sed -i '' "s/import { exportService } from '.\/exportService'/import { exportData, ExportHelpers } from '.\/export'/g" src/services/*.ts
sed -i '' "s/import type { ExportOptions } from '..\/exportService'/import type { ExportOptions } from '..\/export'/g" src/services/export/*.ts

# Fix pages
sed -i '' "s/import { exportService } from '..\/services\/exportService'/import { exportData, downloadExport, ExportHelpers } from '..\/services\/export'/g" src/pages/*.tsx

# Replace exportService.export calls
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/exportService\.export(/exportData(/g' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/exportService\.exportToCSV(/ExportHelpers.toCSV(/g' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/exportService\.exportToPDF(/ExportHelpers.toPDF(/g' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/exportService\.exportToExcel(/ExportHelpers.toExcel(/g' {} \;
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/exportService\.download(/downloadExport(/g' {} \;

echo "✅ Import updates complete!"