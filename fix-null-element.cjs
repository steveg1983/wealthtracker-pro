#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// List of files with null/Element type errors
const filesToFix = [
  'src/components/dashboard/improved/BudgetStatusSection.tsx',
  'src/components/migration-wizard/FileUploadStep.tsx',
  'src/components/mortgage/calculator/CalculationGrid.tsx',
  'src/components/mortgage/calculator/CalculatorModal.tsx',
  'src/components/mortgage/calculator/ComparisonModal.tsx',
  'src/components/mortgage/components/LoanTypeInfo.tsx',
  'src/components/net-worth/ProjectionChart.tsx',
  'src/components/portfolio/PortfolioMetricsCard.tsx',
  'src/components/qif/ImportResultsPanel.tsx',
  'src/components/reconciliation/ReconciliationResults.tsx',
  'src/components/reconciliation/ReconciliationSuccess.tsx',
  'src/components/reconciliation/UnclearedTransactionsList.tsx',
  'src/components/retirement/ira-comparison/ComparisonResults.tsx',
  'src/components/retirement/isa-calculator/ISAResults.tsx',
  'src/components/retirement/RetirementProjectionDisplay.tsx',
  'src/components/retirement/rmd-calculator/RMDProjectionTable.tsx',
  'src/components/retirement/sipp-calculator/SIPPDrawdownScenarios.tsx',
  'src/components/retirement/sipp-calculator/SIPPProjectionTable.tsx',
  'src/components/retirement/state-tax/ResultsSection.tsx',
  'src/components/retirement/workplace-pension/PensionResults.tsx'
];

let totalFixed = 0;

filesToFix.forEach(filePath => {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`File not found: ${filePath}`);
      return;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    const originalContent = content;
    
    // Replace "return null" with "return <></>" for JSX.Element returns
    // But be careful not to replace in non-component contexts
    
    // Pattern 1: Simple return null statements
    content = content.replace(/return null;/g, (match, offset) => {
      // Check if this is likely in a React component (has JSX.Element in signature)
      const beforeContext = content.substring(Math.max(0, offset - 500), offset);
      if (beforeContext.includes('JSX.Element') || beforeContext.includes('ReactElement') || beforeContext.includes('React.JSX.Element')) {
        totalFixed++;
        return 'return <></>;';
      }
      return match;
    });
    
    // Pattern 2: Conditional return null
    content = content.replace(/\? null/g, (match, offset) => {
      // Check if this is in a JSX context (likely a component return)
      const lineStart = content.lastIndexOf('\n', offset) + 1;
      const lineEnd = content.indexOf('\n', offset);
      const line = content.substring(lineStart, lineEnd);
      
      // If this is a return statement in a component
      if (line.includes('return')) {
        const beforeContext = content.substring(Math.max(0, offset - 500), offset);
        if (beforeContext.includes('JSX.Element') || beforeContext.includes('ReactElement') || beforeContext.includes('React.JSX.Element')) {
          totalFixed++;
          return '? <></>';
        }
      }
      return match;
    });

    if (content !== originalContent) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`✓ Fixed ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
});

console.log(`\nTotal fixes applied: ${totalFixed}`);