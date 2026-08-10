import { readdir, readFile } from 'node:fs/promises'
import { extname, relative, resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dirname, '..')
const roots = ['src', 'public', 'out']
const searchableExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.mjs',
  '.svg',
  '.ts',
  '.tsx',
  '.txt',
  '.webmanifest',
  '.xml',
])
const prohibitedTerms = [
  { caseSensitive: false, value: 'xopslab' },
  { caseSensitive: true, value: 'KubeGraph' },
]

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch((error) => {
    if (error.code === 'ENOENT') {
      return []
    }

    throw error
  })
  const files = []

  for (const entry of entries) {
    const entryPath = resolve(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)))
    } else if (entry.isFile() && searchableExtensions.has(extname(entry.name))) {
      files.push(entryPath)
    }
  }

  return files
}

const files = (
  await Promise.all(roots.map((root) => collectFiles(resolve(repositoryRoot, root))))
).flat()
const violations = []

for (const file of files) {
  const contents = await readFile(file, 'utf8')

  for (const term of prohibitedTerms) {
    const searchableContents = term.caseSensitive ? contents : contents.toLowerCase()
    const searchableTerm = term.caseSensitive ? term.value : term.value.toLowerCase()

    if (searchableContents.includes(searchableTerm)) {
      violations.push(`${relative(repositoryRoot, file)} contains prohibited brand text`)
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Brand check passed across ${files.length} shipped source and artifact files.`)
}
