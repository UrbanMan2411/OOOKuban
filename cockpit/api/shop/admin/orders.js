// GET  /api/shop/admin/orders → GUARDED. { orders, seq }
// POST /api/shop/admin/orders { id, status } → update one order's status.
//      statuses: new | paid | shipped | done | cancelled
import { guard } from '../../_auth.js'
import { readJson, writeJson, SHOP } from '../_lib.js'

export const config = { maxDuration: 30 }
const STATUSES = ['new', 'paid', 'shipped', 'done', 'cancelled']

export default async function handler(req, res) {
  if (guard(req, res)) return

  if (req.method === 'GET') {
    const store = (await readJson(SHOP.orders, { seq: 0, list: [] })) || { seq: 0, list: [] }
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ orders: store.list || [], seq: store.seq || 0 })
  }

  if (req.method === 'POST') {
    let body = req.body
    if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
    const id = body && body.id, status = body && body.status
    if (!id || !STATUSES.includes(status)) return res.status(400).json({ error: 'bad_request' })
    const store = (await readJson(SHOP.orders, { seq: 0, list: [] })) || { seq: 0, list: [] }
    const o = (store.list || []).find((x) => x.id === id)
    if (!o) return res.status(404).json({ error: 'not_found' })
    o.status = status
    o.updatedAt = new Date().toISOString()
    try { await writeJson(SHOP.orders, store) } catch (e) { return res.status(500).json({ error: 'save_failed', message: String((e && e.message) || e) }) }
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'method_not_allowed' })
}
