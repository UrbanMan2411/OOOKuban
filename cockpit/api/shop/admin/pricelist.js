// GET  /api/shop/admin/pricelist → GUARDED. { map, count }
// POST /api/shop/admin/pricelist { map } → save the imported price map.
// The xlsx is parsed in the browser (reusing parsePriceXlsx); here we just
// persist the resulting article → {name,volume,barcode,perBox,pallet,price} map.
import { guard } from '../../_auth.js'
import { readJson, writeJson, SHOP, artKey } from '../_lib.js'

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  if (guard(req, res)) return

  if (req.method === 'GET') {
    const map = (await readJson(SHOP.pricelist, {})) || {}
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ map, count: Object.keys(map).length })
  }

  if (req.method === 'POST') {
    let body = req.body
    if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
    const inc = (body && body.map) || {}
    const map = {}
    for (const [k, v] of Object.entries(inc)) {
      const key = artKey(k)
      if (!key || !v) continue
      map[key] = {
        name: String(v.name || '').slice(0, 200),
        volume: String(v.volume || '').slice(0, 40),
        barcode: String(v.barcode || '').slice(0, 40),
        perBox: String(v.perBox || '').slice(0, 20),
        pallet: String(v.pallet || '').slice(0, 20),
        section: String(v.section || '').slice(0, 80),
        priceRetail: Math.max(0, Math.round(+v.priceRetail || 0)),
        priceOpt: Math.max(0, Math.round(+v.priceOpt || 0)),
      }
    }
    try { await writeJson(SHOP.pricelist, map) } catch (e) { return res.status(500).json({ error: 'save_failed', message: String((e && e.message) || e) }) }
    return res.status(200).json({ ok: true, count: Object.keys(map).length })
  }

  return res.status(405).json({ error: 'method_not_allowed' })
}
