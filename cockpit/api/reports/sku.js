// POST /api/reports/sku — pulls WB funnel + Ozon analytics for the last 30 days,
// builds a unified SKU xlsx and saves it to Blob (reports/). Returns the link.
import * as XLSX from 'xlsx'
import { put } from '@vercel/blob'

export const config = { maxDuration: 30 }

const iso = (d) => d.toISOString().slice(0, 10)

async function wbRows(token, from, to) {
  const r = await fetch('https://seller-analytics-api.wildberries.ru/api/analytics/v3/sales-funnel/products', {
    method: 'POST', headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ nmIDs: [], brandNames: [], objectIDs: [], tagIDs: [], timezone: 'Europe/Moscow', selectedPeriod: { start: from, end: to }, cursor: { limit: 1000 } }),
  })
  const t = await r.text(); if (!r.ok) throw new Error('WB ' + r.status + ': ' + t.slice(0, 120))
  const j = JSON.parse(t)
  return (j.data?.products || []).map((p) => {
    const pr = p.product || {}, s = p.statistic?.selected || {}, c = s.conversions || {}
    return {
      'Площадка': 'WB', 'ABC': '', 'ID': pr.nmId, 'Наименование': [pr.vendorCode, pr.brandName].filter(Boolean).join(' · '),
      'Категория': pr.subjectName || '', 'Выручка ₽': Math.round(+s.orderSum || 0), 'Заказы': +s.orderCount || 0,
      'Показы': +s.openCount || 0, 'В корзину': +s.cartCount || 0, 'Конв. в заказ %': +(c.cartToOrderPercent || 0),
      'Выкуп %': +(c.buyoutPercent || 0), 'Остаток': +(pr.stocks?.balanceSum || 0), 'Рейтинг': +(pr.feedbackRating || 0),
      'Ср. чек ₽': Math.round(+s.avgPrice || 0),
    }
  })
}

async function ozRows(cid, key, from, to) {
  const r = await fetch('https://api-seller.ozon.ru/v1/analytics/data', {
    method: 'POST', headers: { 'Client-Id': cid, 'Api-Key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ date_from: from, date_to: to, metrics: ['revenue', 'ordered_units'], dimension: ['sku'], sort: [{ key: 'revenue', order: 'DESC' }], limit: 1000, offset: 0 }),
  })
  const t = await r.text(); if (!r.ok) throw new Error('Ozon ' + r.status + ': ' + t.slice(0, 120))
  const j = JSON.parse(t)
  return (j.result?.data || []).map((row) => {
    const d = row.dimensions?.[0] || {}, m = row.metrics || []; const rev = +m[0] || 0, u = +m[1] || 0
    return {
      'Площадка': 'Ozon', 'ABC': '', 'ID': d.id || '', 'Наименование': d.name || '', 'Категория': '', 'Выручка ₽': Math.round(rev),
      'Заказы': u, 'Показы': '', 'В корзину': '', 'Конв. в заказ %': '', 'Выкуп %': '', 'Остаток': '', 'Рейтинг': '', 'Ср. чек ₽': u ? Math.round(rev / u) : 0,
    }
  })
}

import { guard } from '../_auth.js'
export default async function handler(req, res) {
  if (guard(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  const { WB_TOKEN, OZON_CLIENT_ID, OZON_API_KEY, BLOB_READ_WRITE_TOKEN } = process.env
  if (!BLOB_READ_WRITE_TOKEN) return res.status(503).json({ error: 'not_configured', message: 'BLOB_READ_WRITE_TOKEN не задан.' })

  const end = Date.now() - 86400000 // end yesterday — today's data is partial
  const TO = iso(new Date(end)), FROM = iso(new Date(end - 30 * 86400000))
  let rows = [], wbErr = '', ozErr = ''
  if (WB_TOKEN) { try { rows = rows.concat(await wbRows(WB_TOKEN, FROM, TO)) } catch (e) { wbErr = String(e.message || e) } } else wbErr = 'WB_TOKEN не задан'
  if (OZON_CLIENT_ID && OZON_API_KEY) { try { rows = rows.concat(await ozRows(OZON_CLIENT_ID, OZON_API_KEY, FROM, TO)) } catch (e) { ozErr = String(e.message || e) } } else ozErr = 'Ozon ключи не заданы'
  rows.sort((a, b) => b['Выручка ₽'] - a['Выручка ₽'])
  if (!rows.length) return res.status(502).json({ error: 'no_data', message: 'Не удалось получить данные.', wbErr, ozErr })

  // ABC by cumulative revenue (Pareto: A ≤80%, B ≤95%, C — остальное), per platform
  for (const pf of ['WB', 'Ozon']) {
    const plat = rows.filter((r) => r['Площадка'] === pf) // already revenue-desc (global sort preserves order)
    const tot = plat.reduce((s, r) => s + (+r['Выручка ₽'] || 0), 0)
    let cum = 0
    for (const r of plat) { cum += (+r['Выручка ₽'] || 0); const sh = tot ? cum / tot : 1; r['ABC'] = sh <= 0.8 ? 'A' : sh <= 0.95 ? 'B' : 'C' }
  }
  const abc = []
  for (const pf of ['WB', 'Ozon']) {
    const tot = rows.filter((r) => r['Площадка'] === pf).reduce((s, r) => s + (+r['Выручка ₽'] || 0), 0)
    for (const cl of ['A', 'B', 'C']) {
      const grp = rows.filter((r) => r['Площадка'] === pf && r['ABC'] === cl)
      const rev = grp.reduce((s, r) => s + (+r['Выручка ₽'] || 0), 0)
      abc.push({ 'Площадка': pf, 'Класс': cl, 'SKU': grp.length, 'Выручка ₽': rev, 'Доля выручки %': tot ? Math.round((rev / tot) * 100) : 0 })
    }
  }

  const sum = (pf, k) => rows.filter((r) => r['Площадка'] === pf).reduce((s, r) => s + (+r[k] || 0), 0)
  const cnt = (pf) => rows.filter((r) => r['Площадка'] === pf).length
  const summary = [
    { 'Площадка': 'WB', 'SKU': cnt('WB'), 'Выручка ₽': sum('WB', 'Выручка ₽'), 'Заказы': sum('WB', 'Заказы') },
    { 'Площадка': 'Ozon', 'SKU': cnt('Ozon'), 'Выручка ₽': sum('Ozon', 'Выручка ₽'), 'Заказы': sum('Ozon', 'Заказы') },
    { 'Площадка': 'ИТОГО', 'SKU': rows.length, 'Выручка ₽': sum('WB', 'Выручка ₽') + sum('Ozon', 'Выручка ₽'), 'Заказы': sum('WB', 'Заказы') + sum('Ozon', 'Заказы') },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Сводка')
  const wsAbc = XLSX.utils.json_to_sheet(abc); wsAbc['!cols'] = [{ wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, wsAbc, 'ABC')
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 9 }, { wch: 6 }, { wch: 12 }, { wch: 42 }, { wch: 20 }, { wch: 12 }, { wch: 8 }, { wch: 9 }, { wch: 10 }, { wch: 14 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 11 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Все SKU')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  try {
    const out = await put(`reports/База SKU ${TO}.xlsx`, buf, {
      access: 'public', allowOverwrite: true,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const abcCount = (cl) => rows.filter((r) => r['ABC'] === cl).length
    return res.status(200).json({
      url: out.url, pathname: out.pathname, total: rows.length, wb: cnt('WB'), oz: cnt('Ozon'),
      revenue: sum('WB', 'Выручка ₽') + sum('Ozon', 'Выручка ₽'), from: FROM, to: TO, wbErr, ozErr,
      abc: { A: abcCount('A'), B: abcCount('B'), C: abcCount('C') },
    })
  } catch (e) { return res.status(500).json({ error: 'save_failed', message: String(e.message || e) }) }
}
