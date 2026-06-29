// GET  /api/shop/admin/settings → GUARDED. Full store settings + token status.
// POST /api/shop/admin/settings { settings } → save (non-secret) settings.
// Secrets (bot/provider tokens) live in env vars, NOT here — we only report
// whether they are configured.
import { guard } from '../../_auth.js'
import { readJson, writeJson, SHOP, DEFAULT_SETTINGS } from '../_lib.js'
import { storageReady, isSelfHost } from '../../_storage.js'

export default async function handler(req, res) {
  if (guard(req, res)) return

  const tokens = {
    bot: !!process.env.TG_BOT_TOKEN,
    provider: !!process.env.TG_PROVIDER_TOKEN,
    storage: storageReady(),
    storageMode: isSelfHost() ? 'файловое (на сервере)' : (process.env.BLOB_READ_WRITE_TOKEN ? 'Vercel Blob' : 'не настроено'),
    wb: !!process.env.WB_TOKEN,
    ozon: !!(process.env.OZON_CLIENT_ID && process.env.OZON_API_KEY),
  }

  if (req.method === 'GET') {
    const s = { ...DEFAULT_SETTINGS, ...(await readJson(SHOP.settings, {}) || {}) }
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ settings: s, tokens })
  }

  if (req.method === 'POST') {
    let body = req.body
    if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
    const inc = (body && body.settings) || {}
    const cur = { ...DEFAULT_SETTINGS, ...(await readJson(SHOP.settings, {}) || {}) }
    const next = {
      store: {
        name: String((inc.store && inc.store.name) ?? cur.store.name).slice(0, 80),
        about: String((inc.store && inc.store.about) ?? cur.store.about).slice(0, 400),
        contact: String((inc.store && inc.store.contact) ?? cur.store.contact).slice(0, 120),
      },
      currency: 'RUB',
      minOrder: Math.max(0, Math.round(+inc.minOrder || 0)),
      optDiscountPct: Math.max(0, Math.min(90, Math.round(+inc.optDiscountPct || 0))),
      optThreshold: Math.max(0, Math.round(+inc.optThreshold || 0)),
      adminChatId: String(inc.adminChatId ?? cur.adminChatId).replace(/[^0-9-]/g, '').slice(0, 24),
      delivery: Array.isArray(inc.delivery)
        ? inc.delivery.slice(0, 8).map((d, i) => ({
            id: String(d.id || 'd' + i).replace(/[^a-z0-9_-]/gi, '').slice(0, 20) || 'd' + i,
            label: String(d.label || '').slice(0, 60),
            price: Math.max(0, Math.round(+d.price || 0)),
          })).filter((d) => d.label)
        : cur.delivery,
    }
    try { await writeJson(SHOP.settings, next) } catch (e) { return res.status(500).json({ error: 'save_failed', message: String((e && e.message) || e) }) }
    return res.status(200).json({ ok: true, settings: next, tokens })
  }

  return res.status(405).json({ error: 'method_not_allowed' })
}
