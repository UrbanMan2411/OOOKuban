// POST /api/shop/admin/sync — GUARDED. Rebuilds the storefront catalog (hybrid):
//   • backbone + prices  ← imported price list (_shop/pricelist)
//   • live stock + frame ← WB funnel (vendorCode=article, balance) and Ozon analytics
//   • photos             ← Blob "cards/" folder, matched by article
//   • manual edits       ← _shop/overrides (hidden / price / opt / photo / name)
// Dedup key is the normalised article. Sources that fail (missing token, API
// error) are skipped — the build still succeeds from whatever is available.
import { list, storageReady } from '../../_storage.js'
import { guard } from '../../_auth.js'
import { readJson, writeJson, SHOP, artKey } from '../_lib.js'

export const config = { maxDuration: 30 }

const iso = (d) => d.toISOString().slice(0, 10)
const normName = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

async function fetchWb() {
  const token = process.env.WB_TOKEN
  if (!token) return { items: [], note: 'WB_TOKEN не задан' }
  const today = new Date()
  const body = {
    nmIDs: [], brandNames: [], objectIDs: [], tagIDs: [], timezone: 'Europe/Moscow',
    selectedPeriod: { start: iso(new Date(today.getTime() - 90 * 86400000)), end: iso(today) },
    cursor: { limit: 1000 },
  }
  try {
    const r = await fetch('https://seller-analytics-api.wildberries.ru/api/analytics/v3/sales-funnel/products', {
      method: 'POST', headers: { Authorization: token, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (!r.ok) return { items: [], note: `WB ${r.status}` }
    const j = await r.json()
    const products = (j.data && j.data.products) || []
    const items = products.map((p) => {
      const prod = p.product || {}, sel = (p.statistic && p.statistic.selected) || {}
      return {
        article: artKey(prod.vendorCode), name: prod.title || prod.vendorCode || '',
        brand: prod.brandName || '', subject: prod.subjectName || '',
        stock: +(prod.stocks && prod.stocks.balanceSum) || 0, priceRetail: +sel.avgPrice || 0,
        nmId: prod.nmId || '',
      }
    }).filter((x) => x.article)
    return { items, note: `WB: ${items.length}` }
  } catch (e) { return { items: [], note: 'WB: ' + String((e && e.message) || e) } }
}

async function fetchOzon() {
  const clientId = process.env.OZON_CLIENT_ID, apiKey = process.env.OZON_API_KEY
  if (!clientId || !apiKey) return { items: [], note: 'OZON ключи не заданы' }
  const today = new Date()
  const body = {
    date_from: iso(new Date(today.getTime() - 90 * 86400000)), date_to: iso(today),
    metrics: ['revenue', 'ordered_units'], dimension: ['sku'], filters: [],
    sort: [{ key: 'revenue', order: 'DESC' }], limit: 1000, offset: 0,
  }
  try {
    const r = await fetch('https://api-seller.ozon.ru/v1/analytics/data', {
      method: 'POST', headers: { 'Client-Id': String(clientId), 'Api-Key': String(apiKey), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (!r.ok) return { items: [], note: `OZON ${r.status}` }
    const j = await r.json()
    const data = (j.result && j.result.data) || []
    const items = data.map((row) => {
      const dim = (row.dimensions && row.dimensions[0]) || {}, m = row.metrics || []
      const units = +m[1] || 0
      return { sku: dim.id || '', name: dim.name || '', priceRetail: units > 0 ? (+m[0] || 0) / units : 0 }
    }).filter((x) => x.name)
    return { items, note: `OZON: ${items.length}` }
  } catch (e) { return { items: [], note: 'OZON: ' + String((e && e.message) || e) } }
}

async function fetchCardPhotos() {
  if (!storageReady()) return []
  try {
    const { blobs } = await list({ prefix: 'cards/' })
    return blobs.map((b) => ({ url: b.url, key: artKey(b.pathname.split('/').pop().replace(/\.[a-z0-9]+$/i, '')) }))
  } catch { return [] }
}

export default async function handler(req, res) {
  if (guard(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const notes = []
  const [wb, ozon, photos, priceMap, ov] = await Promise.all([
    fetchWb(), fetchOzon(), fetchCardPhotos(),
    readJson(SHOP.pricelist, {}), readJson(SHOP.overrides, {}),
  ])
  notes.push(wb.note, ozon.note, `Фото: ${photos.length}`)
  const overrides = ov || {}
  const prices = priceMap || {}

  // index by article
  const map = new Map()
  const ensure = (article, base = {}) => {
    const k = artKey(article)
    if (!k) return null
    if (!map.has(k)) map.set(k, { article: k, name: '', volume: '', barcode: '', perBox: '', pallet: '', priceRetail: 0, priceOpt: 0, stock: 0, photo: '', section: '', sources: {} })
    Object.assign(map.get(k), base)
    return map.get(k)
  }

  // 1) price list backbone (source of truth for name/dims/retail price)
  for (const [art, p] of Object.entries(prices)) {
    const it = ensure(art)
    if (!it) continue
    it.name = p.name || it.name
    it.volume = p.volume || it.volume
    it.barcode = p.barcode || it.barcode
    it.perBox = p.perBox || it.perBox
    it.pallet = p.pallet || it.pallet
    it.section = p.section || it.section
    if (+p.priceRetail > 0) it.priceRetail = Math.round(+p.priceRetail)
    if (+p.priceOpt > 0) it.priceOpt = Math.round(+p.priceOpt)
    it.sources.price = true
  }

  // 2) WB frame + live stock (and retail price fallback when none from price list)
  for (const w of wb.items) {
    const it = ensure(w.article)
    if (!it) continue
    if (!it.name) it.name = w.name
    if (!it.priceRetail && w.priceRetail) it.priceRetail = Math.round(w.priceRetail)
    if (!it.section && w.subject) it.section = w.subject
    it.stock = Math.max(it.stock, w.stock)
    it.sources.wb = { nmId: w.nmId, stock: w.stock }
  }

  // 3) Ozon — merge into primary items by product fingerprint (type+scent+volume),
  //    because Ozon marketing titles never equal price-list names verbatim.
  //    Unmatched items stay standalone (unique Ozon-only positions).
  // volume from the RAW string — normName strips «0,45»/«1.1» separators
  const volOf = (raw) => {
    const s = String(raw).toLowerCase()
    const l = s.match(/(\d+(?:[.,]\d+)?)\s*л(?![а-яa-z])|(\d+(?:[.,]\d+)?)\s*литр/)
    if (l) return Math.round(parseFloat((l[1] || l[2]).replace(',', '.')) * 1000)
    const ml = s.match(/(\d+)\s*мл/)
    if (ml) return +ml[1]
    return 0
  }
  const productKey = (name, volume) => {
    const raw = String(name || '') + ' ' + String(volume || '')
    const s = normName(raw)
    if (/набор|2\s*шт|3\s*шт|2шт|2х|2x/.test(s)) return null // sets: too ambiguous, keep as-is
    const vol = volOf(raw)
    let type = '', scent = ''
    const scentOf = (pairs) => { for (const [re, v] of pairs) if (re.test(s)) return v; return '' }
    // порядок важен: специфичные типы раньше общих слов («универсальный»,
    // «для стирки» встречаются в маркетинговых хвостах имён Ozon)
    if (/антижир/.test(s)) type = 'antizhir'
    else if (/хозяйствен/.test(s)) type = 'hozmylo'
    else if (/кондиционер|ополаскиватель/.test(s)) { type = 'kond'; scent = scentOf([[/лаванд/, 'lavanda'], [/морозн/, 'moroz'], [/сияни/, 'siyanie'], [/хлопк|хлопок/, 'hlopok'], [/южн/, 'yuzh'], [/миндал/, 'mindal'], [/детск/, 'kids']]) }
    else if (/стирк|стиральн/.test(s)) { type = 'gel'; scent = scentOf([[/детск/, 'kids'], [/цветн/, 'color'], [/черно|чёрно|темн/, 'black'], [/белого|белое/, 'white'], [/лаванд/, 'lavanda'], [/морозн|пятновывод/, 'moroz'], [/хлопк|хлопок/, 'hlopok'], [/миндал/, 'mindal']]) }
    else if (/кухня|кухни/.test(s) && /eco|эко/.test(s)) type = 'kuhnya'
    else if (/ванн/.test(s)) type = 'vanna'
    else if (/туалет|сантехник/.test(s)) type = /eco|эко/.test(s) ? 'tualet-eco' : 'tualet'
    else if (/антизасор/.test(s)) type = 'antizasor'
    else if (/антисептик/.test(s)) type = 'antiseptik'
    // NB: \b не работает с кириллицей в JS — границы через пробелы/край строки
    else if (/(^|\s)пол(ы|ов|а)($|\s)|мытья пол/.test(s)) {
      type = 'poly'; scent = scentOf([[/цитрус/, 'citrus'], [/прохлад|морск/, 'sea'], [/стронг|ph/, 'strong'], [/полевы/, 'field']])
      if (!scent && /уборк|универсал/.test(s)) { type = 'uborka'; } // «уборка-эко … для мытья пола» — это уборка
    }
    else if (/пенка/.test(s)) { type = 'penka'; scent = scentOf([[/клубник/, 'klubnika'], [/бергамот/, 'bergamot'], [/мелисс/, 'melissa'], [/лемонграсс/, 'lemongrass'], [/детск|0\+/, 'kids']]) }
    else if (/посуд/.test(s)) { type = 'posuda'; scent = scentOf([[/изумруд/, 'izumrud'], [/лаванд/, 'lavanda'], [/ромашк/, 'romashka'], [/delicate|деликат/, 'delicate']]) }
    else if (/мыло/.test(s)) { type = 'mylo'; scent = scentOf([[/виноград/, 'vinograd'], [/вишн/, 'vishnya'], [/клубник/, 'klubnika'], [/кокос/, 'kokos'], [/алоэ/, 'aloe'], [/детск|0\+/, 'kids']]) }
    else if (/вода/.test(s) && /утюг|парогенератор/.test(s)) type = 'voda'
    else if (/белизна/.test(s)) type = 'belizna'
    else if (/уборк|универсал/.test(s)) type = 'uborka'
    if (!type) return null
    // scent is mandatory where one product type has many variants
    if (['gel', 'kond', 'mylo', 'posuda', 'poly', 'penka'].includes(type) && !scent) return null
    if (!vol) return null
    const v = (type === 'gel' && vol === 1000) ? 1100 : vol // гелей «1 л» не бывает — опечатка прайса вместо 1,1 л
    return `${type}|${scent}|${v}`
  }
  const byFp = new Map()
  for (const it of map.values()) {
    const k = productKey(it.name, it.volume)
    if (k && !byFp.has(k)) byFp.set(k, it)
  }
  const byNorm = new Map([...map.values()].map((it) => [normName(it.name), it]))
  for (const o of ozon.items) {
    const hit = byNorm.get(normName(o.name)) || byFp.get(productKey(o.name, '') || ' ')
    if (hit) {
      if (!hit.priceRetail && o.priceRetail) hit.priceRetail = Math.round(o.priceRetail)
      hit.sources.ozon = { sku: o.sku }
    } else {
      const it = ensure('OZ-' + o.sku, { name: o.name })
      if (it) { if (!it.priceRetail && o.priceRetail) it.priceRetail = Math.round(o.priceRetail); it.sources.ozon = { sku: o.sku } }
    }
  }

  // 4) photos by article
  const photoByKey = new Map(photos.map((p) => [p.key, p.url]))
  for (const it of map.values()) {
    if (it.photo) continue
    if (photoByKey.has(it.article)) { it.photo = photoByKey.get(it.article); continue }
    // loose contains-match (filename embeds the article or vice versa)
    for (const p of photos) {
      if (p.key && (p.key.includes(it.article) || it.article.includes(p.key))) { it.photo = p.url; break }
    }
  }

  // 5) manual overrides last
  let items = [...map.values()].map((it) => {
    const o = overrides[it.article]
    if (o) {
      if (o.name) it.name = o.name
      if (o.priceRetail != null && o.priceRetail !== '') it.priceRetail = Math.round(+o.priceRetail) || it.priceRetail
      if (o.priceOpt != null && o.priceOpt !== '') it.priceOpt = Math.round(+o.priceOpt)
      if (o.photo) it.photo = o.photo
      it.hidden = !!o.hidden
    }
    return it
  })

  // sort: in-stock & priced first, then by name
  items.sort((a, b) => (b.stock > 0) - (a.stock > 0) || a.name.localeCompare(b.name, 'ru'))

  const built = { items, updatedAt: new Date().toISOString(), notes }
  try { await writeJson(SHOP.catalog, built) }
  catch (e) { return res.status(500).json({ error: 'save_failed', message: String((e && e.message) || e), notes }) }

  return res.status(200).json({ ok: true, count: items.length, notes, updatedAt: built.updatedAt })
}
