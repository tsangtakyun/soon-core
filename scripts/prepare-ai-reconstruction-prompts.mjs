import fs from 'node:fs'
import path from 'node:path'

const input = process.argv[2]
const output = process.argv[3]
if (!input || !output) throw new Error('Usage: node scripts/prepare-ai-reconstruction-prompts.mjs <input.json> <output.json>')

const source = JSON.parse(fs.readFileSync(input, 'utf8'))
const sanitized = {
  ...source,
  source_restoration_path: 'reference-restoration.json',
  styles: source.styles.map((style) => {
    const safe = { ...style }
    delete safe.source_path
    return safe
  }),
}
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, `${JSON.stringify(sanitized, null, 2)}\n`)
