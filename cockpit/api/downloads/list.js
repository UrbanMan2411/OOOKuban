// GET /api/downloads/list → { items:[{url,pathname,size,uploadedAt}] }
// Lists every file in the Vercel Blob store (newest first).
import { list, storageReady } from '../_storage.js'

import { guard } from '../_auth.js'
export default async function handler(req, res) {
  if (guard(req, res)) return
  if (!storageReady()) {
    return res.status(503).json({ error: 'not_configured', message: 'Хранилище не настроено (BLOB_READ_WRITE_TOKEN или STORAGE_DIR).' })
  }
  try {
    const { blobs } = await list()
    const items = blobs
      .filter((b) => !b.pathname.startsWith('_')) // hide config blobs (_config/…)
      .map((b) => ({ url: b.url, pathname: b.pathname, size: b.size, uploadedAt: b.uploadedAt }))
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ items })
  } catch (e) {
    return res.status(500).json({ error: 'list_failed', message: String((e && e.message) || e) })
  }
}
