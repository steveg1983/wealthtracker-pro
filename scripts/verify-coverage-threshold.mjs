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

const maybeMergeVitestShards = () => {
  const coverageDir = path.dirname(coveragePath);
  const tmpDir = path.join(coverageDir, '.tmp');
  if (!fs.existsSync(tmpDir)) {
    return false;
  }

  const shardFiles = fs.readdirSync(tmpDir)
    .filter(file => file.startsWith('coverage-') && file.endsWith('.json'))
    .map(file => path.join(tmpDir, file));

  if (shardFiles.length === 0) {
    return false;
  }

  const merged = {};

  for (const shardPath of shardFiles) {
    let shardJson;
    try {
      shardJson = JSON.parse(fs.readFileSync(shardPath, 'utf-8'));
    } catch {
      continue;
    }

    for (const [filePath, entry] of Object.entries(shardJson)) {
      if (!entry || typeof entry !== 'object') continue;

      const current = merged[filePath] ?? {
        ...entry,
        s: {},
        f: {},
        b: {}
      };

      const statements = entry.s ?? {};
      for (const [id, count] of Object.entries(statements)) {
        current.s[id] = (current.s[id] ?? 0) + (typeof count === 'number' ? count : 0);
      }

      const functions = entry.f ?? {};
      for (const [id, count] of Object.entries(functions)) {
        current.f[id] = (current.f[id] ?? 0) + (typeof count === 'number' ? count : 0);
      }

      const branches = entry.b ?? {};
      for (const [id, counts] of Object.entries(branches)) {
        if (!Array.isArray(counts)) continue;
        const existing = current.b[id] ?? [];
        current.b[id] = counts.map((value, idx) => (existing[idx] ?? 0) + (typeof value === 'number' ? value : 0));
      }

      // Preserve metadata from the latest shard (they should be identical).
      current.statementMap = entry.statementMap;
      current.fnMap = entry.fnMap;
      current.branchMap = entry.branchMap;
      current.path = entry.path ?? current.path ?? filePath;
      current.inputSourceMap = entry.inputSourceMap ?? current.inputSourceMap;

      merged[filePath] = current;
    }
  }

  if (Object.keys(merged).length === 0) {
    return false;
  }

  fs.mkdirSync(path.dirname(coveragePath), { recursive: true });
  fs.writeFileSync(coveragePath, JSON.stringify(merged, null, 2));
  return true;
};

if (!fs.existsSync(coveragePath)) {
  const merged = maybeMergeVitestShards();
  if (!merged || !fs.existsSync(coveragePath)) {
    console.error(`Coverage file not found: ${coveragePath}`);
    process.exit(1);
  }
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
