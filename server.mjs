import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, request as httpRequest } from 'node:http'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const dist = join(root, 'dist')
const host = '127.0.0.1'
const port = Number(process.env.PORT ?? process.env.RAPIDJAM_SERVE_PORT ?? 5173)
const deviceHost = '192.168.7.1'
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

const send = (response, status, body, headers = {}) => {
  response.writeHead(status, { 'Cache-Control': 'no-cache', ...headers })
  response.end(body)
}

const proxy = (request, response) => {
  const targetPath = request.url.slice('/rapidjam-api'.length) || '/'
  const proxyRequest = httpRequest({
    hostname: deviceHost,
    port: 80,
    path: targetPath,
    method: request.method,
    headers: { ...request.headers, host: deviceHost },
  }, (proxyResponse) => {
    response.writeHead(proxyResponse.statusCode ?? 502, proxyResponse.headers)
    proxyResponse.pipe(response)
  })

  proxyRequest.on('error', (error) => {
    if (!response.headersSent) send(response, 502, `RapidJAM request failed: ${error.message}`, { 'Content-Type': 'text/plain; charset=utf-8' })
    else response.destroy(error)
  })
  request.pipe(proxyRequest)
}

const serveStatic = (request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url, `http://${host}:${port}`).pathname)
  const relativePath = requestPath === '/' ? 'index.html' : requestPath.slice(1)
  const filePath = normalize(join(dist, relativePath))
  const safeRoot = dist.endsWith(sep) ? dist : `${dist}${sep}`
  const resolvedPath = existsSync(filePath) && statSync(filePath).isFile() && filePath.startsWith(safeRoot) ? filePath : join(dist, 'index.html')

  if (!existsSync(resolvedPath)) {
    send(response, 503, 'Run npm run build before npm run serve.', { 'Content-Type': 'text/plain; charset=utf-8' })
    return
  }

  response.writeHead(200, { 'Cache-Control': 'no-cache', 'Content-Type': mimeTypes[extname(resolvedPath)] ?? 'application/octet-stream' })
  createReadStream(resolvedPath).pipe(response)
}

if (!existsSync(dist)) {
  console.error('dist/ was not found. Run npm run build first.')
  process.exit(1)
}

createServer((request, response) => {
  if (request.method === 'OPTIONS') {
    send(response, 204)
    return
  }
  if (!request.url) {
    send(response, 400, 'Missing request URL.')
    return
  }
  if (request.url === '/rapidjam-api' || request.url.startsWith('/rapidjam-api/')) {
    proxy(request, response)
    return
  }
  serveStatic(request, response)
}).listen(port, host, () => {
  console.log(`RapidJAM Configurator: http://${host}:${port}/?transport=http`)
  console.log(`RapidJAM API proxy: http://${host}:${port}/rapidjam-api -> http://${deviceHost}`)
})