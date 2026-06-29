// Self-host server for cockpit: runs the same /api handlers as Vercel, serves
// the built dashboard (index.html) + storefront (shop.html), and serves stored
// files from disk at /_storage. Start with:
//   STORAGE_DIR=/var/lib/greenpanda/cockpit PUBLIC_BASE=https://app.example.com \
//   node --env-file=.env server/index.js
import express from 'express'
import multer from 'multer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isAuthed } from '../api/_auth.js'
import { put, storageReady, STORAGE_PREFIX } from '../api/_storage.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist')
const STORAGE_DIR = process.env.STORAGE_DIR || ''
const PORT = process.env.PORT || 3000

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '2mb' }))

// Map each route to its Vercel-style handler module (loaded lazily, cached).
const ROUTES = [
  ['/api/auth', '../api/auth.js'],
  ['/api/wb/top-sku', '../api/wb/top-sku.js'],
  ['/api/ozon/top-sku', '../api/ozon/top-sku.js'],
  ['/api/plan/board', '../api/plan/board.js'],
  ['/api/reports/sku', '../api/reports/sku.js'],
  ['/api/reports/weekly', '../api/reports/weekly.js'],
  ['/api/downloads/list', '../api/downloads/list.js'],
  ['/api/downloads/folders', '../api/downloads/folders.js'],
  ['/api/downloads/delete', '../api/downloads/delete.js'],
  ['/api/downloads/move', '../api/downloads/move.js'],
  ['/api/shop/catalog', '../api/shop/catalog.js'],
  ['/api/shop/settings', '../api/shop/settings.js'],
  ['/api/shop/order', '../api/shop/order.js'],
  ['/api/shop/bot', '../api/shop/bot.js'],
  ['/api/shop/admin/sync', '../api/shop/admin/sync.js'],
  ['/api/shop/admin/catalog', '../api/shop/admin/catalog.js'],
  ['/api/shop/admin/orders', '../api/shop/admin/orders.js'],
  ['/api/shop/admin/settings', '../api/shop/admin/settings.js'],
  ['/api/shop/admin/pricelist', '../api/shop/admin/pricelist.js'],
]
const cache = new Map()
const handlerFor = async (mod) => {
  if (!cache.has(mod)) cache.set(mod, (await import(mod)).default)
  return cache.get(mod)
}
for (const [route, mod] of ROUTES) {
  app.all(route, async (req, res) => {
    try { (await handlerFor(mod))(req, res) }
    catch (e) { res.status(500).json({ error: 'handler_failed', message: String((e && e.message) || e) }) }
  })
}

// Self-host file upload: multipart straight to disk (replaces Vercel client-upload).
app.post('/api/downloads/upload', multer({ limits: { fileSize: 60 * 1024 * 1024 } }).single('file'), async (req, res) => {
  if (!isAuthed(req)) return res.status(401).json({ error: 'unauthorized' })
  if (!storageReady()) return res.status(503).json({ error: 'not_configured' })
  const pathname = (req.body && req.body.pathname) || (req.file && req.file.originalname)
  if (!pathname || pathname.startsWith('_') || pathname.includes('..')) return res.status(400).json({ error: 'bad_path', message: 'Недопустимый путь файла.' })
  if (!req.file) return res.status(400).json({ error: 'no_file' })
  try {
    const r = await put(pathname, req.file.buffer, { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: req.file.mimetype })
    return res.status(200).json({ url: r.url, pathname: r.pathname })
  } catch (e) { return res.status(500).json({ error: 'upload_failed', message: String((e && e.message) || e) }) }
})

// Stored files (uploaded photos, JSON, etc.).
if (STORAGE_DIR) app.use(STORAGE_PREFIX, express.static(STORAGE_DIR, { fallthrough: false }))

// Built assets, then the two HTML entries with SPA fallback.
app.use(express.static(DIST, { index: false }))
app.get('/shop', (req, res) => res.sendFile(path.join(DIST, 'shop.html')))
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith(STORAGE_PREFIX)) return res.status(404).json({ error: 'not_found' })
  res.sendFile(path.join(DIST, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`cockpit server on :${PORT} · storage=${STORAGE_DIR || '(vercel blob)'} · base=${process.env.PUBLIC_BASE || '(none)'}`)
})
