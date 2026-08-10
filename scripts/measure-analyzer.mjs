import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

const iterations = 250
const warmupRounds = 25
const server = await createServer({
  appType: 'custom',
  logLevel: 'error',
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  server: { middlewareMode: true },
})

function percentile(sortedValues, fraction) {
  return sortedValues[Math.min(sortedValues.length - 1, Math.floor(sortedValues.length * fraction))]
}

try {
  const [{ analyzeManifest }, { manifestExamples }] = await Promise.all([
    server.ssrLoadModule('/src/domain/parser/analyze-manifest.ts'),
    server.ssrLoadModule('/src/content/examples/resource-inventory.ts'),
  ])
  const sources = manifestExamples.map((example) => example.source)

  for (let round = 0; round < warmupRounds; round += 1) {
    for (const source of sources) {
      analyzeManifest(source)
    }
  }

  const samples = []
  for (let round = 0; round < iterations; round += 1) {
    for (const source of sources) {
      const start = performance.now()
      analyzeManifest(source)
      samples.push(performance.now() - start)
    }
  }

  samples.sort((left, right) => left - right)
  const total = samples.reduce((sum, sample) => sum + sample, 0)
  const result = {
    node: process.version,
    inputs: sources.length,
    inputBytes: sources.reduce((sum, source) => sum + Buffer.byteLength(source), 0),
    samples: samples.length,
    meanMilliseconds: Number((total / samples.length).toFixed(3)),
    medianMilliseconds: Number(percentile(samples, 0.5).toFixed(3)),
    p95Milliseconds: Number(percentile(samples, 0.95).toFixed(3)),
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
} finally {
  await server.close()
}
