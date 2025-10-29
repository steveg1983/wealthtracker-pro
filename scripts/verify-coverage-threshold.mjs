#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const USAGE = `Usage: verify-coverage-threshold.mjs <coverage-json-path> --statements=<min> --branches=<min>`;

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error(USAGE);
  process.exit(1);
}

const coveragePath = path.resolve(process.cwd(), args[0]);
let statementsThreshold;
let branchesThreshold;

for (const arg of args.slice(1)) {
  if (arg.startsWith('--statements=')) {
    statementsThreshold = Number(arg.split('=')[1]);
  } else if (arg.startsWith('--branches=')) {
    branchesThreshold = Number(arg.split('=')[1]);
  }
}

if (Number.isNaN(statementsThreshold) || Number.isNaN(branchesThreshold)) {
  console.error('Both --statements and --branches thresholds are required.');
  process.exit(1);
}

if (!fs.existsSync(coveragePath)) {
  console.error(`Coverage file not found: ${coveragePath}`);
  process.exit(1);
}

const coverageRaw = fs.readFileSync(coveragePath, 'utf-8');
const coverage = JSON.parse(coverageRaw);

let totalStatementsCovered = 0;
let totalStatements = 0;
let totalBranchesCovered = 0;
let totalBranches = 0;

for (const fileCoverage of Object.values(coverage)) {
  if (!fileCoverage || typeof fileCoverage !== 'object') continue;
  const s = fileCoverage.s;
  const b = fileCoverage.b;

  if (s) {
    for (const value of Object.values(s)) {
      totalStatements += 1;
      if (typeof value === 'number' && value > 0) {
        totalStatementsCovered += 1;
      }
    }
  }

  if (b) {
    for (const branchCounts of Object.values(b)) {
      if (Array.isArray(branchCounts)) {
        branchCounts.forEach(count => {
          totalBranches += 1;
          if (typeof count === 'number' && count > 0) {
            totalBranchesCovered += 1;
          }
        });
      }
    }
  }
}

const statementsPercent = totalStatements === 0 ? 100 : (totalStatementsCovered / totalStatements) * 100;
const branchesPercent = totalBranches === 0 ? 100 : (totalBranchesCovered / totalBranches) * 100;

const statementsPass = statementsPercent >= statementsThreshold;
const branchesPass = branchesPercent >= branchesThreshold;

console.log(`Statements: ${statementsPercent.toFixed(2)}% (threshold ${statementsThreshold}%)`);
console.log(`Branches: ${branchesPercent.toFixed(2)}% (threshold ${branchesThreshold}%)`);

if (!statementsPass || !branchesPass) {
  console.error('Coverage thresholds not met.');
  process.exit(1);
}
