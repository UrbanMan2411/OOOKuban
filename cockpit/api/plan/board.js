// Shared kanban board, stored in Blob (versioned like the folders registry:
// each write a new immutable URL, reads take the newest → no stale CDN reads).
// GET  /api/plan/board        → { board | null }
// POST /api/plan/board {board} → save
import { list, put, del, getJson, storageReady } from '../_storage.js'
import { guard } from '../_auth.js'

const PREFIX = '_plan/board'

async function readBoard() {
  const { blobs } = await list({ prefix: PREFIX })
  if (!blobs.length) return null
  blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
  let board = null
  const j = await getJson(blobs[0].url)
  if (j && j.board) board = j.board
  if (blobs.length > 1) for (const o of blobs.slice(1)) { try { await del(o.url) } catch { /* ignore */ } }
  return board
}

async function writeBoard(board) {
  await put(PREFIX + '.json', JSON.stringify({ board, ts: Date.now() }), {
    access: 'public', addRandomSuffix: true, contentType: 'application/json',
  })
}

export default async function handler(req, res) {
  if (guard(req, res)) return
  if (!storageReady()) return res.status(503).json({ error: 'not_configured', message: 'Хранилище не настроено (BLOB_READ_WRITE_TOKEN или STORAGE_DIR).' })

  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ board: await readBoard() })
  }
  if (req.method === 'POST') {
    let body = req.body
    if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
    if (!body || !body.board || !body.board.cards) return res.status(400).json({ error: 'bad_board' })
    try { await writeBoard(body.board); return res.status(200).json({ ok: true }) }
    catch (e) { return res.status(500).json({ error: 'save_failed', message: String((e && e.message) || e) }) }
  }
  return res.status(405).json({ error: 'method_not_allowed' })
}
