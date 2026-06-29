// Folder registry stored in a config blob (_config/folders.json). Lets users
// create / rename / delete top-level folders from the site. Renaming changes
// only the display label — the path-prefix key stays stable, so files never
// move and links never break.
//
// GET  /api/downloads/folders                      → { folders:[{key,label}] }
// POST { action:'create', label }                  → add a folder
// POST { action:'rename', key, label }             → change a folder's label
// POST { action:'delete', key }                    → remove an empty folder
import { list, put, del, getJson, storageReady } from '../_storage.js'

// Registry is written with a random suffix each time → each version has its own
// immutable URL. Reads pick the NEWEST version (by uploadedAt) and fetch its
// immutable URL, which is never stale (unlike overwriting one fixed pathname,
// where the Blob CDN can keep serving the old content for a while).
const PREFIX = '_config/folders'
const DEFAULTS = [
  { key: 'prices', label: 'Прайсы' },
  { key: 'cards', label: 'Карточки' },
  { key: 'reports', label: 'Отчёты' },
]

async function readRegistry() {
  const { blobs } = await list({ prefix: PREFIX })
  if (!blobs.length) return null
  blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
  const newest = blobs[0]
  let folders = null
  const j = await getJson(newest.url)
  if (j && Array.isArray(j.folders)) folders = j.folders
  // best-effort cleanup of superseded versions
  if (blobs.length > 1) {
    for (const old of blobs.slice(1)) { try { await del(old.url) } catch { /* ignore */ } }
  }
  return folders
}

async function writeRegistry(folders) {
  await put(PREFIX + '.json', JSON.stringify({ folders }), {
    access: 'public', addRandomSuffix: true, contentType: 'application/json',
  })
}

const slugify = (s) =>
  s.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'folder'

import { guard } from '../_auth.js'
export default async function handler(req, res) {
  if (guard(req, res)) return
  if (!storageReady()) {
    return res.status(503).json({ error: 'not_configured', message: 'Хранилище не настроено (BLOB_READ_WRITE_TOKEN или STORAGE_DIR).' })
  }
  try {
    let folders = await readRegistry()
    if (!folders) { folders = DEFAULTS.slice(); await writeRegistry(folders) }

    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json({ folders })
    }

    if (req.method === 'POST') {
      let body = req.body
      if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
      const action = body && body.action

      if (action === 'create') {
        const label = (body.label || '').trim()
        if (!label) return res.status(400).json({ error: 'no_label', message: 'Введите название папки.' })
        const taken = new Set(folders.map((f) => f.key).concat('misc', '_config'))
        let base = slugify(label), key = base, i = 2
        while (taken.has(key)) key = `${base}-${i++}`
        folders.push({ key, label })
        await writeRegistry(folders)
        return res.status(200).json({ folders, created: { key, label } })
      }

      if (action === 'rename') {
        const label = (body.label || '').trim()
        if (!label) return res.status(400).json({ error: 'no_label', message: 'Введите название.' })
        const f = folders.find((x) => x.key === body.key)
        if (f) f.label = label
        else if (body.key) folders.push({ key: body.key, label }) // upsert self-healed folder
        else return res.status(404).json({ error: 'not_found' })
        await writeRegistry(folders)
        return res.status(200).json({ folders })
      }

      if (action === 'delete') {
        const key = body.key
        if (!folders.some((x) => x.key === key)) return res.status(404).json({ error: 'not_found' })
        const { blobs } = await list({ prefix: key + '/' })
        if (blobs.length) {
          return res.status(409).json({ error: 'not_empty', message: 'В папке есть файлы — сначала удалите или перенесите их.' })
        }
        folders = folders.filter((x) => x.key !== key)
        await writeRegistry(folders)
        return res.status(200).json({ folders })
      }

      return res.status(400).json({ error: 'bad_action' })
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  } catch (e) {
    return res.status(500).json({ error: 'folders_failed', message: String((e && e.message) || e) })
  }
}
