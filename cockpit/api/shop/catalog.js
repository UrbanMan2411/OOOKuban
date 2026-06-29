// GET /api/shop/catalog → { items, settings } — PUBLIC storefront feed.
// Reads the built catalog from Blob; falls back to the demo catalog so the
// store is never empty. Hidden items are filtered out; opt prices are filled
// from the discount setting when not set manually. No secrets are exposed.
import { readJson, SHOP, DEMO_CATALOG, DEFAULT_SETTINGS, paymentsEnabled } from './_lib.js'

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })

  const built = await readJson(SHOP.catalog, null)
  const settings = { ...DEFAULT_SETTINGS, ...(await readJson(SHOP.settings, {}) || {}) }
  const list = (built && Array.isArray(built.items) && built.items.length) ? built.items : DEMO_CATALOG

  const disc = Math.max(0, Math.min(90, +settings.optDiscountPct || 0))
  const items = list
    .filter((p) => !p.hidden)
    .map((p) => {
      const retail = Math.max(0, Math.round(+p.priceRetail || 0))
      const opt = p.priceOpt > 0 ? Math.round(+p.priceOpt) : Math.max(1, Math.round(retail * (1 - disc / 100)))
      return {
        article: p.article, name: p.name, volume: p.volume || '',
        barcode: p.barcode || '', perBox: p.perBox || '', pallet: p.pallet || '',
        priceRetail: retail, priceOpt: opt, stock: Math.max(0, Math.round(+p.stock || 0)),
        photo: p.photo || '', section: p.section || '',
      }
    })

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({
    items,
    settings: {
      store: settings.store, currency: settings.currency || 'RUB',
      minOrder: +settings.minOrder || 0, optDiscountPct: disc,
      optThreshold: +settings.optThreshold || 0,
      delivery: Array.isArray(settings.delivery) ? settings.delivery : DEFAULT_SETTINGS.delivery,
      paymentsEnabled: paymentsEnabled(),
      updatedAt: built && built.updatedAt ? built.updatedAt : null,
      demo: !(built && built.items && built.items.length),
    },
  })
}
