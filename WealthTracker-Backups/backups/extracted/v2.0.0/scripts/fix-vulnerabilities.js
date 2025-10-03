#!/usr/bin/env node

/**
 * Script to fix known vulnerabilities in dependencies
 * Run with: node scripts/fix-vulnerabilities.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔒 Starting vulnerability fixes...\n');

// Track what needs to be done
const fixes = {
  immediate: [],
  manual: [],
  warnings: []
};

// Check current versions
function checkVersion(packageName) {
  try {
    const packageJson = require('../package.json');
    const version = packageJson.dependencies[packageName] || 
                   packageJson.devDependencies[packageName];
    return version;
  } catch (error) {
    return null;
  }
}

// 1. Fix Vercel vulnerability
console.log('1️⃣ Checking Vercel...');
const vercelVersion = checkVersion('vercel');
if (vercelVersion && vercelVersion !== '25.2.0') {
  fixes.immediate.push({
    name: 'vercel',
    command: 'npm install vercel@25.2.0 --save-dev',
    reason: 'Multiple high severity vulnerabilities'
  });
}

// 2. Check localtunnel
console.log('2️⃣ Checking localtunnel...');
const localtunnelVersion = checkVersion('localtunnel');
if (localtunnelVersion) {
  fixes.immediate.push({
    name: 'localtunnel',
    command: 'npm install localtunnel@1.8.3 --save-dev',
    reason: 'Axios vulnerabilities (CSRF, SSRF)',
    alternative: 'Consider removing if not used: npm uninstall localtunnel'
  });
}

// 3. Check xlsx - this requires manual intervention
console.log('3️⃣ Checking xlsx...');
const xlsxVersion = checkVersion('xlsx');
if (xlsxVersion) {
  fixes.manual.push({
    name: 'xlsx',
    issue: 'No fix available for prototype pollution and ReDoS vulnerabilities',
    recommendations: [
      'Replace with exceljs: npm uninstall xlsx && npm install exceljs',
      'Or use a community fork with patches',
      'Or implement strict input validation for all xlsx operations'
    ]
  });
}

// 4. Run audit fix for other issues
console.log('4️⃣ Running npm audit fix...\n');
try {
  execSync('npm audit fix', { stdio: 'inherit' });
} catch (error) {
  fixes.warnings.push('npm audit fix encountered errors - manual review needed');
}

// Display results
console.log('\n📋 VULNERABILITY FIX SUMMARY\n');

if (fixes.immediate.length > 0) {
  console.log('✅ IMMEDIATE FIXES AVAILABLE:');
  fixes.immediate.forEach(fix => {
    console.log(`\n  ${fix.name}:`);
    console.log(`  - Reason: ${fix.reason}`);
    console.log(`  - Run: ${fix.command}`);
    if (fix.alternative) {
      console.log(`  - Alternative: ${fix.alternative}`);
    }
  });
}

if (fixes.manual.length > 0) {
  console.log('\n⚠️  MANUAL INTERVENTION REQUIRED:');
  fixes.manual.forEach(fix => {
    console.log(`\n  ${fix.name}:`);
    console.log(`  - Issue: ${fix.issue}`);
    console.log('  - Recommendations:');
    fix.recommendations.forEach(rec => {
      console.log(`    • ${rec}`);
    });
  });
}

if (fixes.warnings.length > 0) {
  console.log('\n⚡ WARNINGS:');
  fixes.warnings.forEach(warning => {
    console.log(`  - ${warning}`);
  });
}

// Create a fix script
if (fixes.immediate.length > 0) {
  console.log('\n📝 Creating automated fix script...');
  
  const fixScript = fixes.immediate
    .map(fix => fix.command)
    .join('\n');
  
  const scriptPath = path.join(__dirname, 'apply-fixes.sh');
  fs.writeFileSync(scriptPath, `#!/bin/bash\n\n${fixScript}\n`, 'utf8');
  fs.chmodSync(scriptPath, '755');
  
  console.log(`\n✅ Fix script created: ${scriptPath}`);
  console.log('   Run it with: ./scripts/apply-fixes.sh');
}

// Check for security tools
console.log('\n🔧 RECOMMENDED SECURITY TOOLS:\n');

const securityTools = [
  { name: 'snyk', check: 'npx snyk --version', install: 'npm install -g snyk' },
  { name: 'retire', check: 'npx retire --version', install: 'npm install -g retire' },
  { name: 'npm-check-updates', check: 'npx ncu --version', install: 'npm install -g npm-check-updates' }
];

securityTools.forEach(tool => {
  try {
    execSync(tool.check, { stdio: 'ignore' });
    console.log(`✅ ${tool.name} - installed`);
  } catch (error) {
    console.log(`❌ ${tool.name} - not installed (install with: ${tool.install})`);
  }
});

console.log('\n🚀 Next Steps:');
console.log('1. Review and apply immediate fixes');
console.log('2. Address manual interventions (especially xlsx)');
console.log('3. Run npm audit again to verify fixes');
console.log('4. Set up automated security scanning in CI/CD');
console.log('5. Schedule regular security audits\n');