import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'

const outputRoot = resolve(process.cwd(), process.env.STATIC_EXPORT_DIR ?? 'out')
const hostname = process.env.HOST ?? '127.0.0.1'
const port = Number(process.env.PORT ?? 4173)
const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH)
const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json'],
  ['.woff2', 'font/woff2'],
])

function normalizeBasePath(value) {
  if (!value || value === '/') {
    return ''
  }

  return `/${value.replace(/^\/+|\/+$/g, '')}`
}

function stripBasePath(pathname) {
  if (!basePath) {
    return pathname
  }

  if (pathname === basePath) {
    return null
  }

  if (!pathname.startsWith(`${basePath}/`)) {
    return undefined
  }

  return pathname.slice(basePath.length) || '/'
}

function resolveInsideOutput(pathname) {
  const relativePath = pathname.replace(/^\/+/, '')
  const filePath = resolve(outputRoot, relativePath)

  if (filePath !== outputRoot && !filePath.startsWith(`${outputRoot}${sep}`)) {
    return undefined
  }

  return filePath
}

async function findFile(pathname) {
  const candidates = []
  const directPath = resolveInsideOutput(pathname)

  if (!directPath) {
    return undefined
  }

  if (pathname.endsWith('/')) {
    candidates.push(resolve(directPath, 'index.html'))
  } else {
    candidates.push(directPath)

    if (!extname(pathname)) {
      candidates.push(`${directPath}.html`, resolve(directPath, 'index.html'))
    }
  }

  for (const candidate of candidates) {
    const candidateStat = await stat(candidate).catch(() => undefined)

    if (candidateStat?.isFile()) {
      return candidate
    }
  }

  return undefined
}

function streamFile(response, filePath, statusCode = 200, method = 'GET') {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': mimeTypes.get(extname(filePath)) ?? 'application/octet-stream',
  })

  if (method === 'HEAD') {
    response.end()
    return
  }

  createReadStream(filePath).pipe(response)
}

const server = createServer(async (request, response) => {
  try {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' })
      response.end('Method not allowed')
      return
    }

    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
    const strippedPath = stripBasePath(pathname)

    if (strippedPath === null) {
      response.writeHead(308, { Location: `${basePath}/` })
      response.end()
      return
    }

    if (strippedPath === undefined) {
      response.writeHead(404)
      response.end('Not found')
      return
    }

    const filePath = await findFile(strippedPath)

    if (filePath) {
      streamFile(response, filePath, 200, request.method)
      return
    }

    const notFoundPath = await findFile('/404.html')

    if (notFoundPath) {
      streamFile(response, notFoundPath, 404, request.method)
      return
    }

    response.writeHead(404)
    response.end('Not found')
  } catch (error) {
    console.error('Static export server failed to handle a request.', error)
    response.writeHead(500)
    response.end('Internal server error')
  }
})

server.listen(port, hostname, () => {
  console.log(`Serving the static export at http://${hostname}:${port}${basePath}/`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
  })
}
