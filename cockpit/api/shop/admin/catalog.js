// GET  /api/shop/admin/catalog → GUARDED. Full catalog incl. hidden + overrides.
// POST /api/shop/admin/catalog { overrides } → save the overrides map and
//      re-apply it to the stored catalog (no marketplace refetch — fast).
import { guard } from '../../_auth.js'
import { readJson, writeJson, SHOP, DEMO_CATALOG, artKey } from '../_lib.js'

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  if (guard(req, res)) return

  if (req.method === 'GET') {
    const built = await readJson(SHOP.catalog, null)
    const overrides = (await readJson(SHOP.overrides, {})) || {}
    const items = (built && built.items && built.items.length) ? built.items : DEMO_CATALOG
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ items, overrides, updatedAt: built && built.updatedAt, demo: !(built && built.items && built.items.length) })
  }

  if (req.method === 'POST') {
    let body = req.body
    if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
    const incoming = (body && body.overrides) || {}
    // normalise keys + keep only known fields
    const overrides = {}
    for (const [k, v] of Object.entries(incoming)) {
      const key = artKey(k)
      if (!key || !v) continue
      const o = {}
      if (v.hidden) o.hidden = true
      if (v.name) o.name = String(v.name).slice(0, 200)
      if (v.priceRetail !== '' && v.priceRetail != null) o.priceRetail = Math.max(0, Math.round(+v.priceRetail) || 0)
      if (v.priceOpt !== '' && v.priceOpt != null) o.priceOpt = Math.max(0, Math.round(+v.priceOpt) || 0)
      if (v.photo) o.photo = String(v.photo).slice(0, 600)
      if (Object.keys(o).length) overrides[key] = o
    }
    try { await writeJson(SHOP.overrides, overrides) }
    catch (e) { return res.status(500).json({ error: 'save_failed', message: String((e && e.message) || e) }) }

    // re-apply overrides to the built catalog so the storefront updates immediately
    const built = await readJson(SHOP.catalog, null)
    if (built && Array.isArray(built.items)) {
      for (const it of built.items) {
        const o = overrides[it.article]
        it.hidden = !!(o && o.hidden)
        if (o) {
          if (o.name) it.name = o.name
          if (o.priceRetail != null) it.priceRetail = o.priceRetail
          if (o.priceOpt != null) it.priceOpt = o.priceOpt
          if (o.photo) it.photo = o.photo
        }
      }
      try { await writeJson(SHOP.catalog, built) } catch { /* overrides already saved */ }
    }
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'method_not_allowed' })
}
