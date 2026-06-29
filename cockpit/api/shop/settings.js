// GET /api/shop/settings → PUBLIC, safe subset of store settings (no secrets).
import { readJson, SHOP, DEFAULT_SETTINGS, paymentsEnabled } from './_lib.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })
  const s = { ...DEFAULT_SETTINGS, ...(await readJson(SHOP.settings, {}) || {}) }
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({
    store: s.store, currency: s.currency || 'RUB',
    minOrder: +s.minOrder || 0, optDiscountPct: +s.optDiscountPct || 0,
    optThreshold: +s.optThreshold || 0,
    delivery: Array.isArray(s.delivery) ? s.delivery : DEFAULT_SETTINGS.delivery,
    paymentsEnabled: paymentsEnabled(),
  })
}
