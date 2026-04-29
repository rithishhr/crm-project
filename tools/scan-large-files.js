// Simple Node script to scan the repo for files larger than a threshold (default 1MB)
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const threshold = Number(process.env.SIZE_THRESHOLD_MB || 1) * 1024 * 1024
const out = []

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      // skip node_modules and .git
      if (['node_modules', '.git'].includes(e.name)) continue
      walk(p)
    } else {
      try {
        const s = fs.statSync(p)
        if (s.size >= threshold) out.push({ path: path.relative(root, p), size: s.size })
      } catch (err) { }
    }
  }
}

walk(root)
out.sort((a, b) => b.size - a.size)
const outFile = path.join(root, 'cleanup-report.txt')
const lines = out.map(i => `${(i.size/1024/1024).toFixed(2)} MB	${i.path}`)
fs.writeFileSync(outFile, ['Large files report', `Threshold: ${threshold} bytes`, '', ...lines].join('\n'), 'utf8')
console.log('cleanup-report.txt written with', lines.length, 'entries')
