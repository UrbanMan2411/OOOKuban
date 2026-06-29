// POST /api/downloads/move { fromUrl, fromPathname, toPathname }
// Moves/renames a blob: copy to the new pathname, then delete the original.
// Used for both "move between folders" and "rename file" (both = new pathname).
import { copy, del, storageReady, isOwnUrl } from '../_storage.js'

import { guard } from '../_auth.js'
export default async function handler(req, res) {
  if (guard(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  if (!storageReady()) {
    return res.status(503).json({ error: 'not_configured', message: 'Хранилище не настроено (BLOB_READ_WRITE_TOKEN или STORAGE_DIR).' })
  }
  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  const { fromUrl, fromPathname, toPathname } = body || {}
  if (!fromUrl || !toPathname) return res.status(400).json({ error: 'bad_request', message: 'Нужны fromUrl и toPathname.' })
  // guard: only our own store, no config blobs, no traversal
  if (!isOwnUrl(fromUrl)) {
    return res.status(400).json({ error: 'bad_url', message: 'fromUrl должен быть ссылкой нашего хранилища.' })
  }
  if (toPathname.startsWith('_') || toPathname.includes('..') ||
      (fromPathname && (fromPathname.startsWith('_') || fromPathname.includes('..')))) {
    return res.status(400).json({ error: 'bad_path', message: 'Недопустимый путь.' })
  }
  if (fromPathname && fromPathname === toPathname) return res.status(200).json({ unchanged: true })

  try {
    const dest = await copy(fromUrl, toPathname, {
      access: 'public', addRandomSuffix: false, allowOverwrite: true,
    })
    // delete the original (copy created a new object at toPathname)
    try { await del(fromUrl) } catch { /* original may already be gone */ }
    return res.status(200).json({ url: dest.url, pathname: dest.pathname })
  } catch (e) {
    return res.status(500).json({ error: 'move_failed', message: String((e && e.message) || e) })
  }
}
