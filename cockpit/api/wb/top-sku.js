// Vercel serverless function — proxies the Wildberries Analytics v3 "Sales
// Funnel" (воронка продаж по карточкам). Server-to-server only; the WB token
// lives in env (WB_TOKEN) and never reaches the browser.
//
// Endpoint: POST https://seller-analytics-api.wildberries.ru/api/analytics/v3/sales-funnel/products
// Body uses `selectedPeriod:{start,end}` and `cursor:{limit}`; there is no
// server-side orderBy, so we fetch a wide page and sort by revenue here.
//
// GET /api/wb/top-sku?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=30
// → { from, to, limit, rows:[{nmId,vendorCode,brand,subject,views,cart,orders,
//      revenue,buyouts,buyoutsSum,cancels,avgPrice,convCart,convOrder,buyoutPct}], totals }

const WB_URL = 'https://seller-analytics-api.wildberries.ru/api/analytics/v3/sales-funnel/products'

import { guard } from '../_auth.js'
export default async function handler(req, res) {
  if (guard(req, res)) return
  const token = process.env.WB_TOKEN
  if (!token) {
    return res.status(503).json({
      error: 'not_configured',
      message:
        'Не задан WB_TOKEN в переменных окружения Vercel. Создайте токен в кабинете WB ' +
        '(Профиль → Настройки → Доступ к API, категория «Аналитика», только чтение) и передеплойте.',
    })
  }

  const q = req.query || {}
  const iso = (d) => d.toISOString().slice(0, 10)
  const today = new Date()
  const to = typeof q.to === 'string' && q.to ? q.to : iso(today)
  const from =
    typeof q.from === 'string' && q.from ? q.from : iso(new Date(today.getTime() - 30 * 86400000))
  let limit = parseInt(q.limit, 10) || 30
  limit = Math.min(Math.max(limit, 1), 100)

  // Fetch a wide page (no server-side sort in v3) and rank locally.
  const body = {
    nmIDs: [],
    brandNames: [],
    objectIDs: [],
    tagIDs: [],
    timezone: 'Europe/Moscow',
    selectedPeriod: { start: from, end: to },
    cursor: { limit: 1000 },
  }

  let wbResp, text
  try {
    wbResp = await fetch(WB_URL, {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    text = await wbResp.text()
  } catch (e) {
    return res.status(502).json({ error: 'fetch_failed', message: String((e && e.message) || e) })
  }

  if (!wbResp.ok) {
    return res.status(wbResp.status).json({
      error: 'wb_error',
      status: wbResp.status,
      message: (text || '').slice(0, 600),
    })
  }

  let json
  try {
    json = JSON.parse(text)
  } catch {
    return res.status(502).json({ error: 'bad_json', message: (text || '').slice(0, 300) })
  }

  const products = (json.data && json.data.products) || []
  let rows = products.map((p) => {
    const prod = p.product || {}
    const sel = (p.statistic && p.statistic.selected) || {}
    const conv = sel.conversions || {}
    const stocks = prod.stocks || {}
    return {
      nmId: prod.nmId || '',
      title: prod.title || '',
      vendorCode: prod.vendorCode || '',
      brand: prod.brandName || '',
      subject: prod.subjectName || '',
      rating: +prod.feedbackRating || 0,
      stock: +stocks.balanceSum || 0,
      views: +sel.openCount || 0,
      cart: +sel.cartCount || 0,
      orders: +sel.orderCount || 0,
      revenue: +sel.orderSum || 0,
      buyouts: +sel.buyoutCount || 0,
      buyoutsSum: +sel.buyoutSum || 0,
      cancels: +sel.cancelCount || 0,
      avgPrice: +sel.avgPrice || 0,
      convCart: +conv.addToCartPercent || 0,
      convOrder: +conv.cartToOrderPercent || 0,
      buyoutPct: +conv.buyoutPercent || 0,
    }
  })

  // Rank by revenue (orderSum) and keep the requested top-N.
  rows.sort((a, b) => b.revenue - a.revenue)
  const fetched = rows.length
  rows = rows.slice(0, limit)

  const totals = {
    revenue: rows.reduce((s, r) => s + r.revenue, 0),
    orders: rows.reduce((s, r) => s + r.orders, 0),
    views: rows.reduce((s, r) => s + r.views, 0),
    skuCount: rows.length,
    fetched, // how many SKUs were scanned to build this top-N
  }

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ from, to, limit, rows, totals })
}
