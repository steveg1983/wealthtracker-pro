# XLSX Migration Guide

## Overview

The `xlsx` library has critical security vulnerabilities with no available patches:
- Prototype Pollution (CVE GHSA-4r6h-8v6p-xvw6)
- Regular Expression Denial of Service (ReDoS) (CVE GHSA-5pgg-2g8v-p4x9)

This guide provides instructions for migrating to a secure alternative.

## Current Usage

The `xlsx` library is currently used in:
- `/src/components/ExcelExport.tsx` - For exporting data to Excel format

## Recommended Alternative: ExcelJS

[ExcelJS](https://github.com/exceljs/exceljs) is a mature, actively maintained library with:
- No known security vulnerabilities
- Better TypeScript support
- More features and flexibility
- Active community and regular updates

## Migration Steps

### 1. Install ExcelJS

```bash
npm uninstall xlsx
npm install exceljs
npm install --save-dev @types/exceljs
```

### 2. Update ExcelExport.tsx

Here's how to migrate the ExcelExport component:

```typescript
// Replace the import
// OLD: import { utils, writeFile } from 'xlsx';
// NEW:
import ExcelJS from 'exceljs';

// Update the dynamic import
// OLD: XLSX = await import('xlsx');
// NEW: No dynamic import needed with ExcelJS

// Create workbook
// OLD: const wb = XLSX.utils.book_new();
// NEW:
const workbook = new ExcelJS.Workbook();
workbook.creator = 'Wealth Tracker';
workbook.created = new Date();

// Add worksheet
// OLD: const ws = XLSX.utils.json_to_sheet(data);
//      XLSX.utils.book_append_sheet(wb, ws, 'Sheet Name');
// NEW:
const worksheet = workbook.addWorksheet('Sheet Name');

// Add data with headers
// OLD: const ws = XLSX.utils.json_to_sheet(transactionData);
// NEW:
// Define columns
worksheet.columns = [
  { header: 'Date', key: 'date', width: 12 },
  { header: 'Description', key: 'description', width: 30 },
  { header: 'Category', key: 'category', width: 15 },
  { header: 'Amount', key: 'amount', width: 12 },
  // ... more columns
];

// Add rows
worksheet.addRows(transactionData);

// Apply styles
// OLD: ws['!cols'] = [{ wch: 12 }, { wch: 30 }];
// NEW:
worksheet.columns.forEach((column, index) => {
  column.width = columnWidths[index];
  column.alignment = { vertical: 'middle', horizontal: 'left' };
});

// Auto filters
// OLD: ws['!autofilter'] = { ref: 'A1:E10' };
// NEW:
worksheet.autoFilter = {
  from: 'A1',
  to: 'E10'
};

// Conditional formatting for negative values
worksheet.addConditionalFormatting({
  ref: 'E2:E1000',
  rules: [
    {
      type: 'cellIs',
      operator: 'lessThan',
      formulae: [0],
      style: {
        font: { color: { argb: 'FF9C0006' } },
        fill: {
          type: 'pattern',
          pattern: 'solid',
          bgColor: { argb: 'FFFFC7CE' }
        }
      }
    }
  ]
});

// Export file
// OLD: XLSX.writeFile(wb, filename);
// NEW:
const buffer = await workbook.xlsx.writeBuffer();
const blob = new Blob([buffer], { 
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
});
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = filename;
a.click();
URL.revokeObjectURL(url);
```

### 3. Enhanced Features with ExcelJS

ExcelJS provides additional features that can enhance the export:

```typescript
// Add header styling
worksheet.getRow(1).font = { bold: true };
worksheet.getRow(1).fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE0E0E0' }
};

// Freeze panes
worksheet.views = [
  { state: 'frozen', xSplit: 0, ySplit: 1 }
];

// Number formatting
worksheet.getColumn('amount').numFmt = '$#,##0.00;[Red]-$#,##0.00';

// Add borders
worksheet.eachRow((row, rowNumber) => {
  row.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });
});

// Zebra striping
worksheet.eachRow((row, rowNumber) => {
  if (rowNumber % 2 === 0) {
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF5F5F5' }
    };
  }
});
```

## Testing Migration

1. Test all export functionality:
   - Summary export
   - Transaction export with grouping
   - Account export
   - Budget export
   - Category export

2. Verify formatting:
   - Column widths
   - Auto filters
   - Conditional formatting
   - Date and currency formats

3. Performance testing:
   - Export large datasets (1000+ transactions)
   - Memory usage comparison

## Alternative: Implement Input Validation

If migration is not immediately feasible, implement strict input validation:

```typescript
// Sanitize data before passing to xlsx
function sanitizeForExcel(data: any): any {
  if (typeof data === 'string') {
    // Remove potential formula injections
    if (data.startsWith('=') || data.startsWith('+') || 
        data.startsWith('-') || data.startsWith('@')) {
      return `'${data}`;
    }
    // Limit string length to prevent ReDoS
    return data.substring(0, 32767);
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeForExcel);
  }
  
  if (data && typeof data === 'object') {
    const sanitized: any = {};
    for (const key in data) {
      // Prevent prototype pollution
      if (data.hasOwnProperty(key) && 
          !['__proto__', 'constructor', 'prototype'].includes(key)) {
        sanitized[key] = sanitizeForExcel(data[key]);
      }
    }
    return sanitized;
  }
  
  return data;
}

// Use before passing to xlsx
const sanitizedData = sanitizeForExcel(transactionData);
const ws = XLSX.utils.json_to_sheet(sanitizedData);
```

## Benefits of Migration

1. **Security**: Eliminates known vulnerabilities
2. **Features**: More advanced Excel features
3. **Performance**: Better memory management
4. **Maintenance**: Active development and support
5. **TypeScript**: Better type definitions
6. **Stability**: More mature and battle-tested

## Timeline

1. **Immediate**: Implement input validation as a temporary measure
2. **Week 1**: Complete migration to ExcelJS
3. **Week 2**: Thorough testing and bug fixes
4. **Week 3**: Deploy to production

## Support

For questions or issues during migration:
1. Review ExcelJS documentation: https://github.com/exceljs/exceljs
2. Check migration examples in this guide
3. Test thoroughly in development before deploying