const { danger, fail, warn, message } = require('danger')

const addedLines = danger.github.pr.additions || 0
const deletedLines = danger.github.pr.deletions || 0
const changedFiles = danger.github.pr.changed_files || 0

const LARGE_LINES = 300
const LARGE_FILES = 10

if (addedLines + deletedLines > LARGE_LINES) {
  warn(`PR is large: ~${addedLines + deletedLines} lines changed. Consider splitting.`)
}
if (changedFiles > LARGE_FILES) {
  warn(`PR touches ${changedFiles} files. Prefer small, focused PRs.`)
}

const body = (danger.github.pr.body || '').toLowerCase()
if (!body.includes('summary')) {
  warn('PR description missing a Summary section')
}

const pkgChanged = danger.git.modified_files.includes('package.json') || danger.git.created_files.includes('package.json')
const lockChanged = danger.git.modified_files.includes('package-lock.json') || danger.git.created_files.includes('package-lock.json')
if (pkgChanged || lockChanged) {
  const labels = (danger.github.issue.labels || []).map((l) => l.name)
  if (!labels.includes('deps-approved')) {
    fail('Dependencies changed. Add label `deps-approved` after reviewer approval to proceed.')
  }
}

const bannedPatterns = [
  { re: /as\s+any/g, msg: 'Usage of "as any" detected.' },
  { re: /@ts-ignore/g, msg: 'Usage of @ts-ignore is forbidden.' },
  { re: /as\s+unknown\s+as/g, msg: 'Double cast "as unknown as" detected.' },
  { re: /\.backup(\.|$)/g, msg: 'Backup files are not allowed.' },
  { re: /\bTODO\b|\bFIXME\b/g, msg: 'Leftover TODO/FIXME markers found.' },
]

async function scanDiffs() {
  const diff = await danger.git.diff()
  const violations = []
  for (const { before, after, file } of diff.files) {
    const text = [before, after].filter(Boolean).join('\n')
    for (const pat of bannedPatterns) {
      if (pat.re.test(text)) {
        violations.push(`- ${pat.msg} (${file})`)
      }
    }
  }
  if (violations.length) {
    fail(`Banned patterns detected in changes:\n${violations.join('\n')}`)
  }
}

async function checkSkippedTests() {
  const changedFiles = [
    ...danger.git.created_files,
    ...danger.git.modified_files,
  ].filter((f) => /\.(ts|js)$/.test(f))

  const content = await Promise.all(changedFiles.map((f) => danger.git.diffForFile(f)))
  const offenders = []
  content.forEach((c, idx) => {
    if (!c) return
    const file = changedFiles[idx]
    const txt = (c.added || '') + '\n' + (c.removed || '')
    if (/\.skip\s*\(/.test(txt)) offenders.push(file)
  })
  if (offenders.length) {
    fail(`Skipped tests detected in: ${offenders.join(', ')}`)
  }
}

schedule(async () => {
  await scanDiffs()
  await checkSkippedTests()
})

message('Danger checks completed. Keep PRs small and verified.')

