#!/usr/bin/env node

/**
 * Quick Accessibility Check Script
 * Run this before manual testing to catch obvious issues
 */

import { chromium } from 'playwright';
import axe from '@axe-core/playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5173';

// Pages to test
const PAGES = [
  { name: 'Dashboard', path: '/' },
  { name: 'Transactions', path: '/transactions' },
  { name: 'Accounts', path: '/accounts' },
  { name: 'Budget', path: '/budget' },
  { name: 'Goals', path: '/goals' },
  { name: 'Analytics', path: '/analytics' },
  { name: 'Settings', path: '/settings' }
];

// Color contrast specific selectors to check
const CONTRAST_CHECKS = [
  { selector: '.text-red-500', description: 'Negative amounts (red)' },
  { selector: '.text-green-500', description: 'Positive amounts (green)' },
  { selector: '.bg-secondary', description: 'Table headers (#8EA9DB background)' },
  { selector: '.text-primary', description: 'Primary text color' },
  { selector: '.bg-primary', description: 'Primary buttons' }
];

async function runAccessibilityTests() {
  console.log('🔍 Starting automated accessibility checks...\n');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const results = {
    summary: {
      totalViolations: 0,
      criticalViolations: 0,
      seriousViolations: 0,
      moderateViolations: 0,
      minorViolations: 0
    },
    pages: {},
    contrastIssues: []
  };

  // Test each page
  for (const pageInfo of PAGES) {
    console.log(`Testing ${pageInfo.name}...`);
    
    try {
      await page.goto(`${BASE_URL}${pageInfo.path}`, { 
        waitUntil: 'networkidle' 
      });
      
      // Wait for content to load
      await page.waitForTimeout(2000);
      
      // Run axe accessibility checks
      const accessibilityScanResults = await axe.run(page);
      
      results.pages[pageInfo.name] = {
        violations: accessibilityScanResults.violations.length,
        passes: accessibilityScanResults.passes.length,
        incomplete: accessibilityScanResults.incomplete.length,
        issues: accessibilityScanResults.violations.map(violation => ({
          id: violation.id,
          impact: violation.impact,
          description: violation.description,
          help: violation.help,
          helpUrl: violation.helpUrl,
          nodes: violation.nodes.length
        }))
      };
      
      // Update summary
      accessibilityScanResults.violations.forEach(violation => {
        results.summary.totalViolations += violation.nodes.length;
        
        switch (violation.impact) {
          case 'critical':
            results.summary.criticalViolations += violation.nodes.length;
            break;
          case 'serious':
            results.summary.seriousViolations += violation.nodes.length;
            break;
          case 'moderate':
            results.summary.moderateViolations += violation.nodes.length;
            break;
          case 'minor':
            results.summary.minorViolations += violation.nodes.length;
            break;
        }
      });
      
      console.log(`✓ ${pageInfo.name} - Found ${accessibilityScanResults.violations.length} issues`);
      
    } catch (error) {
      console.error(`✗ Error testing ${pageInfo.name}:`, error.message);
      results.pages[pageInfo.name] = { error: error.message };
    }
  }
  
  // Quick contrast check on dashboard
  console.log('\n🎨 Checking specific color contrasts...');
  
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  for (const check of CONTRAST_CHECKS) {
    try {
      const elements = await page.$$(check.selector);
      if (elements.length > 0) {
        // Get computed styles
        const styles = await elements[0].evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            color: computed.color,
            backgroundColor: computed.backgroundColor,
            selector: el.className
          };
        });
        
        results.contrastIssues.push({
          ...check,
          found: true,
          styles
        });
      } else {
        results.contrastIssues.push({
          ...check,
          found: false
        });
      }
    } catch (error) {
      console.error(`Error checking ${check.selector}:`, error.message);
    }
  }
  
  await browser.close();
  
  // Generate report
  generateReport(results);
}

function generateReport(results) {
  console.log('\n📊 Accessibility Check Summary\n');
  console.log('═══════════════════════════════════════════');
  
  // Summary
  console.log(`Total Violations: ${results.summary.totalViolations}`);
  console.log(`  - Critical: ${results.summary.criticalViolations}`);
  console.log(`  - Serious: ${results.summary.seriousViolations}`);
  console.log(`  - Moderate: ${results.summary.moderateViolations}`);
  console.log(`  - Minor: ${results.summary.minorViolations}`);
  
  // Page details
  console.log('\n📄 Page-by-Page Results:\n');
  
  Object.entries(results.pages).forEach(([pageName, pageResults]) => {
    console.log(`${pageName}:`);
    
    if (pageResults.error) {
      console.log(`  ❌ Error: ${pageResults.error}`);
    } else {
      console.log(`  ✓ Passes: ${pageResults.passes}`);
      console.log(`  ⚠️  Violations: ${pageResults.violations}`);
      console.log(`  ❓ Incomplete: ${pageResults.incomplete}`);
      
      if (pageResults.issues.length > 0) {
        console.log('  Issues:');
        pageResults.issues.forEach(issue => {
          console.log(`    - [${issue.impact}] ${issue.id}: ${issue.description} (${issue.nodes} instances)`);
        });
      }
    }
    console.log('');
  });
  
  // Contrast checks
  console.log('🎨 Color Contrast Checks:\n');
  results.contrastIssues.forEach(issue => {
    if (issue.found) {
      console.log(`✓ Found: ${issue.description}`);
      console.log(`  Color: ${issue.styles.color}`);
      console.log(`  Background: ${issue.styles.backgroundColor}`);
    } else {
      console.log(`✗ Not found: ${issue.description}`);
    }
    console.log('');
  });
  
  // Save detailed report
  const reportPath = path.join(process.cwd(), 'accessibility-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Detailed report saved to: ${reportPath}`);
  
  // Recommendations
  console.log('\n📋 Next Steps:');
  console.log('1. Fix any critical or serious violations first');
  console.log('2. Run manual screen reader testing');
  console.log('3. Verify color contrasts with a contrast checker tool');
  console.log('4. Test keyboard navigation manually');
  console.log('5. Test with real users with disabilities');
}

// Run tests
runAccessibilityTests().catch(console.error);