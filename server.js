import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT_DIR = fileURLToPath(new URL('.', import.meta.url))
const DIST_DIR = join(ROOT_DIR, 'dist')
const IS_PRODUCTION = process.argv.includes('--production')

if (!IS_PRODUCTION) {
  process.env.NODE_ENV = 'development'
}

const vite = IS_PRODUCTION
  ? null
  : await Promise.all([import('vite'), import('@vitejs/plugin-vue')]).then(
      ([{ createServer: createViteServer }, { default: vue }]) => createViteServer({
        appType: 'spa',
        configFile: false,
        plugins: [vue()],
        resolve: { alias: { '@': join(ROOT_DIR, 'src') } },
        root: ROOT_DIR,
        server: { middlewareMode: true },
      }),
    )

const contentTypes = {
  '.avif': 'image/avif',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

function serveProductionFile(requestUrl, response) {
  let pathname

  try {
    pathname = decodeURIComponent(requestUrl.pathname)
  } catch {
    sendJson(response, 400, { message: 'Geçersiz istek.' })
    return
  }

  const requestedPath = resolve(DIST_DIR, `.${pathname}`)
  const isSafePath = requestedPath === DIST_DIR || requestedPath.startsWith(`${DIST_DIR}${sep}`)
  let filePath = isSafePath ? requestedPath : ''

  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    filePath = join(DIST_DIR, 'index.html')
  }

  if (!existsSync(filePath)) {
    sendJson(response, 503, { message: 'Uygulama derlenmemiş. Önce npm run build komutunu çalıştırın.' })
    return
  }

  response.writeHead(200, {
    'Content-Type': contentTypes[extname(filePath).toLowerCase()] || 'application/octet-stream',
  })

  if (requestUrl.method === 'HEAD') {
    response.end()
    return
  }

  createReadStream(filePath).pipe(response)
}

const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url, 'http://localhost')
  const pathname = requestUrl.pathname

  if (pathname.startsWith('/api/')) {
    sendJson(res, 404, { message: 'Endpoint bulunamadı.' })
  } else if (vite) {
    vite.middlewares(req, res)
  } else if (req.method === 'GET' || req.method === 'HEAD') {
    serveProductionFile({ pathname, method: req.method }, res)
  } else {
    sendJson(res, 405, { message: 'Desteklenmeyen istek metodu.' })
  }
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`Vue Weather ${IS_PRODUCTION ? 'production' : 'development'} server: http://localhost:${PORT}`)
})
