#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// WCAG 2.1 Guidelines to check
const wcagGuidelines = {
  'perceivable': {
    '1.1': 'Text Alternatives',
    '1.2': 'Time-based Media',
    '1.3': 'Adaptable',
    '1.4': 'Distinguishable'
  },
  'operable': {
    '2.1': 'Keyboard Accessible',
    '2.2': 'Enough Time',
    '2.3': 'Seizures and Physical Reactions',
    '2.4': 'Navigable',
    '2.5': 'Input Modalities'
  },
  'understandable': {
    '3.1': 'Readable',
    '3.2': 'Predictable',
    '3.3': 'Input Assistance'
  },
  'robust': {
    '4.1': 'Compatible'
  }
};

async function auditAccessibility() {
  console.log('\n♿ WCAG 2.1 Accessibility Audit\n');
  console.log('═'.repeat(50));

  const srcPath = path.join(__dirname, '..', 'src');
  const issues = [];
  const warnings = [];
  const passes = [];

  // Get all component files
  const componentFiles = await glob('**/*.{tsx,jsx}', { 
    cwd: srcPath,
    ignore: ['**/*.test.*', '**/*.spec.*', '**/node_modules/**']
  });

  console.log(`\n📊 Scanning ${componentFiles.length} component files...\n`);

  // Check each file
  for (const file of componentFiles) {
    const filePath = path.join(srcPath, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Skip if it's a test file
    if (file.includes('.test.') || file.includes('.spec.')) continue;

    // 1. Check for img without alt attributes
    const imgMatches = content.match(/<img\s+[^>]*>/g) || [];
    imgMatches.forEach(img => {
      if (!img.includes('alt=')) {
        issues.push({
          file,
          line: getLineNumber(content, img),
          issue: 'Image missing alt attribute',
          wcag: '1.1.1',
          level: 'A',
          fix: 'Add alt="" for decorative images or descriptive alt text'
        });
      }
    });

    // 2. Check for buttons without accessible text
    const buttonMatches = content.match(/<button[^>]*>([^<]*)<\/button>/g) || [];
    buttonMatches.forEach(button => {
      const buttonContent = button.match(/>([^<]*)</)?.[1] || '';
      if (!buttonContent.trim() && !button.includes('aria-label')) {
        issues.push({
          file,
          line: getLineNumber(content, button),
          issue: 'Button without accessible text',
          wcag: '4.1.2',
          level: 'A',
          fix: 'Add text content or aria-label attribute'
        });
      }
    });

    // 3. Check for form inputs without labels
    const inputMatches = content.match(/<input[^>]*>/g) || [];
    inputMatches.forEach(input => {
      if (!input.includes('aria-label') && !input.includes('aria-labelledby')) {
        // Check if there's a label for this input
        const idMatch = input.match(/id=["']([^"']+)["']/);
        if (idMatch && !content.includes(`for="${idMatch[1]}"`)) {
          warnings.push({
            file,
            line: getLineNumber(content, input),
            issue: 'Input possibly missing label',
            wcag: '3.3.2',
            level: 'A',
            fix: 'Add <label> or aria-label attribute'
          });
        }
      }
    });

    // 4. Check for color contrast (simple check for hardcoded colors)
    const colorMatches = content.match(/color:\s*#[0-9a-fA-F]{3,6}/g) || [];
    if (colorMatches.length > 0) {
      warnings.push({
        file,
        issue: `Found ${colorMatches.length} hardcoded colors`,
        wcag: '1.4.3',
        level: 'AA',
        fix: 'Verify color contrast ratio meets WCAG standards (4.5:1 for normal text, 3:1 for large text)'
      });
    }

    // 5. Check for keyboard accessibility
    const clickHandlers = content.match(/onClick\s*=\s*{/g) || [];
    const keyHandlers = content.match(/onKey[A-Z]\w*\s*=\s*{/g) || [];
    if (clickHandlers.length > keyHandlers.length * 2) {
      warnings.push({
        file,
        issue: 'More click handlers than keyboard handlers',
        wcag: '2.1.1',
        level: 'A',
        fix: 'Ensure all interactive elements are keyboard accessible'
      });
    }

    // 6. Check for ARIA attributes
    const ariaMatches = content.match(/aria-[a-z]+=/gi) || [];
    if (ariaMatches.length > 0) {
      passes.push({
        file,
        pass: `Uses ${ariaMatches.length} ARIA attributes`,
        wcag: '4.1.2'
      });
    }

    // 7. Check for semantic HTML
    const semanticTags = ['<nav', '<main', '<header', '<footer', '<section', '<article', '<aside'];
    const usesSemanticHTML = semanticTags.some(tag => content.includes(tag));
    if (usesSemanticHTML) {
      passes.push({
        file,
        pass: 'Uses semantic HTML elements',
        wcag: '1.3.1'
      });
    }

    // 8. Check for focus management
    if (content.includes('focus()') || content.includes('useRef')) {
      passes.push({
        file,
        pass: 'Implements focus management',
        wcag: '2.4.3'
      });
    }
  }

  // Report results
  console.log('\n❌ Critical Issues (Level A):');
  if (issues.length === 0) {
    console.log('  ✅ No critical issues found!');
  } else {
    issues.forEach(issue => {
      console.log(`\n  File: ${issue.file}${issue.line ? `:${issue.line}` : ''}`);
      console.log(`  Issue: ${issue.issue}`);
      console.log(`  WCAG: ${issue.wcag} (Level ${issue.level})`);
      console.log(`  Fix: ${issue.fix}`);
    });
  }

  console.log('\n\n⚠️  Warnings (Need Manual Review):');
  if (warnings.length === 0) {
    console.log('  No warnings found.');
  } else {
    const groupedWarnings = {};
    warnings.forEach(warning => {
      const key = warning.issue;
      if (!groupedWarnings[key]) {
        groupedWarnings[key] = [];
      }
      groupedWarnings[key].push(warning);
    });

    Object.entries(groupedWarnings).forEach(([issue, items]) => {
      console.log(`\n  ${issue} (${items.length} files)`);
      console.log(`  WCAG: ${items[0].wcag} (Level ${items[0].level})`);
      console.log(`  Fix: ${items[0].fix}`);
      if (items.length <= 3) {
        items.forEach(item => console.log(`    - ${item.file}`));
      } else {
        console.log(`    - ${items[0].file}`);
        console.log(`    - ${items[1].file}`);
        console.log(`    ... and ${items.length - 2} more files`);
      }
    });
  }

  console.log('\n\n✅ Good Practices Found:');
  const groupedPasses = {};
  passes.forEach(pass => {
    const key = pass.pass;
    if (!groupedPasses[key]) {
      groupedPasses[key] = 0;
    }
    groupedPasses[key]++;
  });

  Object.entries(groupedPasses).forEach(([practice, count]) => {
    console.log(`  - ${practice} (${count} files)`);
  });

  // Accessibility checklist
  console.log('\n\n📋 Manual Testing Checklist:');
  console.log('  □ Test with keyboard only (Tab, Enter, Escape)');
  console.log('  □ Test with screen reader (NVDA/JAWS on Windows, VoiceOver on Mac)');
  console.log('  □ Test color contrast with tools like WebAIM Contrast Checker');
  console.log('  □ Test with browser zoom at 200%');
  console.log('  □ Test with Windows High Contrast mode');
  console.log('  □ Verify focus indicators are visible');
  console.log('  □ Check for motion sensitivity (prefers-reduced-motion)');
  console.log('  □ Verify error messages are clear and associated with inputs');
  console.log('  □ Test with voice control software');
  console.log('  □ Validate HTML markup (W3C validator)');

  // Score calculation
  const totalChecks = issues.length + warnings.length + passes.length;
  const score = totalChecks > 0 ? ((passes.length / totalChecks) * 100).toFixed(1) : 0;

  console.log('\n\n📊 Accessibility Score:');
  console.log(`  Issues: ${issues.length}`);
  console.log(`  Warnings: ${warnings.length}`);
  console.log(`  Passes: ${Object.keys(groupedPasses).length}`);
  console.log(`  Score: ${score}%`);

  console.log('\n\n🎯 Next Steps:');
  console.log('  1. Fix all critical Level A issues first');
  console.log('  2. Review and address warnings');
  console.log('  3. Run automated testing with axe-core or pa11y');
  console.log('  4. Conduct manual testing with assistive technologies');
  console.log('  5. Consider hiring accessibility consultants for comprehensive audit');

  console.log('\n═'.repeat(50));
  console.log('\n✨ Remember: Accessibility is not just about compliance, it\'s about inclusion!\n');
}

function getLineNumber(content, searchString) {
  const index = content.indexOf(searchString);
  if (index === -1) return null;
  
  const lines = content.substring(0, index).split('\n');
  return lines.length;
}

// Run the audit
auditAccessibility().catch(console.error);