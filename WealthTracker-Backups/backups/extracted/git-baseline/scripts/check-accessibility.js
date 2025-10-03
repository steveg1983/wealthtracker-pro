#!/usr/bin/env node

/**
 * Accessibility check script that provides guidance for manual testing
 * Since I cannot directly run Playwright, this script provides instructions
 */

const fs = require('fs');
const path = require('path');

async function checkAccessibility() {
  console.log('🔍 WealthTracker Accessibility Check\n');
  console.log('This will help identify issues before manual testing.\n');
  
  // Check if dev server is running
  try {
    await execAsync('curl -s http://localhost:5173 > /dev/null');
    console.log('✅ Dev server is running\n');
  } catch {
    console.log('❌ Dev server is not running!');
    console.log('Please run "npm run dev" in another terminal.\n');
    process.exit(1);
  }
  
  console.log('📊 Running accessibility checks...\n');
  
  // Create a simple test file that uses our audit utility
  const testScript = `
import puppeteer from 'puppeteer';

async function runAudit() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  const results = {
    timestamp: new Date().toISOString(),
    pages: {}
  };
  
  const pages = [
    { name: 'Dashboard', url: 'http://localhost:5173/' },
    { name: 'Transactions', url: 'http://localhost:5173/transactions' },
    { name: 'Accounts', url: 'http://localhost:5173/accounts' },
    { name: 'Budget', url: 'http://localhost:5173/budget' },
    { name: 'Goals', url: 'http://localhost:5173/goals' }
  ];
  
  for (const pageInfo of pages) {
    console.log(\`Checking \${pageInfo.name}...\`);
    
    await page.goto(pageInfo.url, { waitUntil: 'networkidle0' });
    await page.waitForTimeout(2000);
    
    // Run our accessibility audit
    const auditResults = await page.evaluate(() => {
      // This runs in the browser context
      if (window.runAccessibilityAudit) {
        return window.runAccessibilityAudit();
      }
      
      // Fallback to basic checks
      const issues = [];
      
      // Check for images without alt text
      document.querySelectorAll('img:not([alt])').forEach(img => {
        issues.push({
          type: 'error',
          element: img.outerHTML.substring(0, 100),
          issue: 'Image missing alt text'
        });
      });
      
      // Check for buttons without accessible text
      document.querySelectorAll('button').forEach(button => {
        if (!button.textContent.trim() && !button.getAttribute('aria-label')) {
          issues.push({
            type: 'error',
            element: button.outerHTML.substring(0, 100),
            issue: 'Button missing accessible text'
          });
        }
      });
      
      // Check for form inputs without labels
      document.querySelectorAll('input, select, textarea').forEach(input => {
        const id = input.id;
        const hasLabel = id && document.querySelector(\`label[for="\${id}"]\`);
        const hasAriaLabel = input.getAttribute('aria-label');
        
        if (!hasLabel && !hasAriaLabel) {
          issues.push({
            type: 'error',
            element: input.outerHTML.substring(0, 100),
            issue: 'Form input missing label'
          });
        }
      });
      
      return { issues, summary: { errors: issues.length } };
    });
    
    results.pages[pageInfo.name] = auditResults;
  }
  
  await browser.close();
  return results;
}

runAudit().then(results => {
  console.log(JSON.stringify(results, null, 2));
}).catch(console.error);
`;

  // Write and run the test script
  const testPath = path.join(process.cwd(), '.accessibility-test.js');
  fs.writeFileSync(testPath, testScript);
  
  try {
    const { stdout } = await execAsync(`node ${testPath}`);
    const results = JSON.parse(stdout);
    
    // Clean up
    fs.unlinkSync(testPath);
    
    // Generate report
    generateReport(results);
    
  } catch (error) {
    console.error('Error running audit:', error.message);
    // Clean up
    if (fs.existsSync(testPath)) {
      fs.unlinkSync(testPath);
    }
  }
}

function generateReport(results) {
  console.log('\n📊 Accessibility Audit Results\n');
  console.log('═══════════════════════════════════════════\n');
  
  let totalIssues = 0;
  
  Object.entries(results.pages).forEach(([pageName, pageResults]) => {
    console.log(`📄 ${pageName}:`);
    
    if (pageResults.issues && pageResults.issues.length > 0) {
      console.log(`   ❌ ${pageResults.issues.length} issues found:\n`);
      
      pageResults.issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue.issue}`);
        console.log(`      Element: ${issue.element}`);
        console.log('');
      });
      
      totalIssues += pageResults.issues.length;
    } else {
      console.log('   ✅ No issues found\n');
    }
  });
  
  console.log('═══════════════════════════════════════════\n');
  console.log(`Total Issues: ${totalIssues}\n`);
  
  // Save detailed report
  const reportPath = path.join(process.cwd(), 'accessibility-quick-check.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`💾 Detailed report saved to: ${reportPath}\n`);
  
  // Manual testing checklist
  console.log('📋 Manual Testing Checklist:\n');
  console.log('1. Screen Reader Testing:');
  console.log('   [ ] Test with NVDA/JAWS (Windows) or VoiceOver (Mac)');
  console.log('   [ ] Verify all interactive elements are announced');
  console.log('   [ ] Check form labels and error messages');
  console.log('   [ ] Test modal focus management\n');
  
  console.log('2. Keyboard Navigation:');
  console.log('   [ ] Tab through entire page');
  console.log('   [ ] Test skip links (first tab)');
  console.log('   [ ] Verify focus indicators are visible');
  console.log('   [ ] Test ESC key closes modals\n');
  
  console.log('3. Color Contrast:');
  console.log('   [ ] Check red text on white (negative amounts)');
  console.log('   [ ] Check green text on white (positive amounts)');
  console.log('   [ ] Check white text on blue (#8EA9DB) headers');
  console.log('   [ ] Test in both light and dark modes\n');
  
  console.log('Use ACCESSIBILITY_TEST_RESULTS.md to track your manual testing progress.\n');
}

// Simple fallback check without puppeteer
async function simpleCheck() {
  console.log('\n🔍 Running simple accessibility check...\n');
  
  console.log('Key areas to test manually:\n');
  
  console.log('1. 📱 Add Transaction Modal:');
  console.log('   - Type selection buttons have aria-pressed');
  console.log('   - All fields have labels and IDs');
  console.log('   - Errors have role="alert"');
  console.log('   - Modal focus is trapped\n');
  
  console.log('2. 📊 Financial Amounts:');
  console.log('   - Red for negative (check contrast)');
  console.log('   - Green for positive (check contrast)');
  console.log('   - Proper formatting with +/- signs\n');
  
  console.log('3. 🎯 Focus Management:');
  console.log('   - Skip links on first tab');
  console.log('   - Modal focus trap');
  console.log('   - Focus returns after modal close\n');
  
  console.log('4. 📢 Live Regions:');
  console.log('   - Error messages announced');
  console.log('   - Success messages announced');
  console.log('   - Loading states communicated\n');
  
  console.log('Run "npm install puppeteer" for automated checks.\n');
}

// Check if puppeteer is available
exec('npm list puppeteer', (error) => {
  if (error) {
    simpleCheck();
  } else {
    checkAccessibility().catch(console.error);
  }
});