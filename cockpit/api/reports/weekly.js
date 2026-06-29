// POST /api/reports/weekly — week-over-week movement (last 7 days vs previous 7).
// WB sales-funnel returns the comparison ("past") period automatically; Ozon is
// fetched for both ranges and matched by SKU. Saves xlsx to Blob (reports/).
import * as XLSX from 'xlsx'
import { put } from '@vercel/blob'

export const config = { maxDuration: 30 }

const DAY = 86400000
const iso = (d) => d.toISOString().slice(0, 10)

async function wbMovers(token, from, to) {
  const r = await fetch('https://seller-analytics-api.wildberries.ru/api/analytics/v3/sales-funnel/products', {
    method: 'POST', headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ nmIDs: [], brandNames: [], objectIDs: [], tagIDs: [], timezone: 'Europe/Moscow', selectedPeriod: { start: from, end: to }, cursor: { limit: 1000 } }),
  })
  const t = await r.text(); if (!r.ok) throw new Error('WB ' + r.status + ': ' + t.slice(0, 120))
  const j = JSON.parse(t)
  return (j.data?.products || []).map((p) => {
    const pr = p.product || {}, cur = p.statistic?.selected || {}, prev = p.statistic?.past || {}
    const a = +cur.orderSum || 0, b = +prev.orderSum || 0
    return { 'Площадка': 'WB', 'Наименование': [pr.vendorCode, pr.brandName].filter(Boolean).join(' · '), cur: a, prev: b }
  })
}

async function ozPeriod(cid, key, from, to) {
  const r = await fetch('https://api-seller.ozon.ru/v1/analytics/data', {
    method: 'POST', headers: { 'Client-Id': cid, 'Api-Key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ date_from: from, date_to: to, metrics: ['revenue'], dimension: ['sku'], sort: [{ key: 'revenue', order: 'DESC' }], limit: 1000, offset: 0 }),
  })
  const t = await r.text(); if (!r.ok) throw new Error('Ozon ' + r.status + ': ' + t.slice(0, 120))
  const j = JSON.parse(t)
  const m = new Map()
  for (const row of (j.result?.data || [])) {
    const d = row.dimensions?.[0] || {}
    m.set(d.id, { name: d.name || d.id, rev: +(row.metrics?.[0]) || 0 })
  }
  return m
}

import { guard } from '../_auth.js'
export default async function handler(req, res) {
  if (guard(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  const { WB_TOKEN, OZON_CLIENT_ID, OZON_API_KEY, BLOB_READ_WRITE_TOKEN } = process.env
  if (!BLOB_READ_WRITE_TOKEN) return res.status(503).json({ error: 'not_configured', message: 'BLOB_READ_WRITE_TOKEN не задан.' })

  const now = Date.now() - DAY // end yesterday — today's data is partial
  const TO = iso(new Date(now)), FROM = iso(new Date(now - 7 * DAY))
  const PREV_FROM = iso(new Date(now - 14 * DAY)), PREV_TO = FROM

  let rows = [], wbErr = '', ozErr = ''
  if (WB_TOKEN) { try { rows = rows.concat(await wbMovers(WB_TOKEN, FROM, TO)) } catch (e) { wbErr = String(e.message || e) } } else wbErr = 'WB_TOKEN не задан'
  if (OZON_CLIENT_ID && OZON_API_KEY) {
    try {
      const [cur, prev] = await Promise.all([ozPeriod(OZON_CLIENT_ID, OZON_API_KEY, FROM, TO), ozPeriod(OZON_CLIENT_ID, OZON_API_KEY, PREV_FROM, PREV_TO)])
      const ids = new Set([...cur.keys(), ...prev.keys()])
      for (const id of ids) {
        const c = cur.get(id), p = prev.get(id)
        rows.push({ 'Площадка': 'Ozon', 'Наименование': (c?.name || p?.name || id), cur: c?.rev || 0, prev: p?.rev || 0 })
      }
    } catch (e) { ozErr = String(e.message || e) }
  } else ozErr = 'Ozon ключи не заданы'

  if (!rows.length) return res.status(502).json({ error: 'no_data', message: 'Нет данных.', wbErr, ozErr })

  // build movement rows
  const movement = rows.map((r) => {
    const d = Math.round(r.cur - r.prev)
    const pct = r.prev > 0 ? Math.round((d / r.prev) * 100) : (r.cur > 0 ? 100 : 0)
    return { 'Площадка': r['Площадка'], 'Наименование': r['Наименование'], 'Выручка, тек ₽': Math.round(r.cur), 'Выручка, пред ₽': Math.round(r.prev), 'Δ ₽': d, 'Δ %': pct }
  }).sort((a, b) => b['Δ ₽'] - a['Δ ₽'])

  const sum = (pf, k) => rows.filter((r) => r['Площадка'] === pf).reduce((s, r) => s + (+r[k] || 0), 0)
  const mk = (pf) => { const c = sum(pf, 'cur'), p = sum(pf, 'prev'); return { 'Площадка': pf, 'Выручка, тек ₽': Math.round(c), 'Выручка, пред ₽': Math.round(p), 'Δ ₽': Math.round(c - p), 'Δ %': p > 0 ? Math.round((c - p) / p * 100) : 0 } }
  const curAll = sum('WB', 'cur') + sum('Ozon', 'cur'), prevAll = sum('WB', 'prev') + sum('Ozon', 'prev')
  const summary = [mk('WB'), mk('Ozon'), { 'Площадка': 'ИТОГО', 'Выручка, тек ₽': Math.round(curAll), 'Выручка, пред ₽': Math.round(prevAll), 'Δ ₽': Math.round(curAll - prevAll), 'Δ %': prevAll > 0 ? Math.round((curAll - prevAll) / prevAll * 100) : 0 }]

  const wb = XLSX.utils.book_new()
  const wsS = XLSX.utils.json_to_sheet(summary); wsS['!cols'] = [{ wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 8 }]
  XLSX.utils.book_append_sheet(wb, wsS, 'Сводка')
  const wsM = XLSX.utils.json_to_sheet(movement); wsM['!cols'] = [{ wch: 9 }, { wch: 44 }, { wch: 14 }, { wch: 14 }, { wch: 11 }, { wch: 8 }]
  XLSX.utils.book_append_sheet(wb, wsM, 'Движение')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  try {
    const out = await put(`reports/Отчёт за неделю ${TO}.xlsx`, buf, { access: 'public', allowOverwrite: true, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const up = movement.filter((m) => m['Δ ₽'] > 0).length, down = movement.filter((m) => m['Δ ₽'] < 0).length
    return res.status(200).json({
      url: out.url, pathname: out.pathname, this_period: `${FROM}..${TO}`, prev_period: `${PREV_FROM}..${PREV_TO}`,
      curAll: Math.round(curAll), prevAll: Math.round(prevAll), deltaPct: prevAll > 0 ? Math.round((curAll - prevAll) / prevAll * 100) : 0,
      up, down, topUp: movement.slice(0, 3).filter((m) => m['Δ ₽'] > 0).map((m) => `${m['Наименование']} +${m['Δ ₽'].toLocaleString('ru-RU')}₽`),
      topDown: movement.slice(-3).filter((m) => m['Δ ₽'] < 0).reverse().map((m) => `${m['Наименование']} ${m['Δ ₽'].toLocaleString('ru-RU')}₽`),
      wbErr, ozErr,
    })
  } catch (e) { return res.status(500).json({ error: 'save_failed', message: String(e.message || e) }) }
}
