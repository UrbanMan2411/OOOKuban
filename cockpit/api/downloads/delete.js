// POST /api/downloads/delete { url } → removes a file from the store.
import { del, storageReady, isOwnUrl, urlToPathname } from '../_storage.js'

import { guard } from '../_auth.js'
export default async function handler(req, res) {
  if (guard(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  if (!storageReady()) {
    return res.status(503).json({ error: 'not_configured', message: 'Хранилище не настроено (BLOB_READ_WRITE_TOKEN или STORAGE_DIR).' })
  }
  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  const url = body && body.url
  if (!url) return res.status(400).json({ error: 'no_url' })
  // guard: only our own store, never the config blobs
  if (!isOwnUrl(url)) {
    return res.status(400).json({ error: 'bad_url', message: 'Ссылка не из нашего хранилища.' })
  }
  try {
    const path = urlToPathname(url)
    if (path.startsWith('_')) return res.status(403).json({ error: 'forbidden', message: 'Системный файл удалять нельзя.' })
    await del(url)
    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: 'delete_failed', message: String((e && e.message) || e) })
  }
}
