// Shared helpers for the Telegram shop endpoints.
// Files starting with "_" are not routed by Vercel — import-only.
import { list, put, del, getJson, storageReady } from '../_storage.js'
import { createHmac } from 'node:crypto'

// ── versioned JSON store (write a new immutable name each time, read the
//    newest, prune the rest). Works on Vercel Blob and on local disk. ──
export async function readJson(prefix, fallback = null) {
  if (!storageReady()) return fallback
  try {
    const { blobs } = await list({ prefix })
    if (!blobs.length) return fallback
    blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
    let out = fallback
    const j = await getJson(blobs[0].url)
    if (j != null) out = j
    if (blobs.length > 1) for (const o of blobs.slice(1)) { try { await del(o.url) } catch { /* ignore */ } }
    return out
  } catch { return fallback }
}

export async function writeJson(prefix, data) {
  if (!storageReady()) throw new Error('Хранилище не настроено (BLOB_READ_WRITE_TOKEN или STORAGE_DIR)')
  await put(prefix + '.json', JSON.stringify(data), {
    access: 'public', addRandomSuffix: true, contentType: 'application/json',
  })
}

export const SHOP = {
  catalog: '_shop/catalog',     // built product list
  overrides: '_shop/overrides', // manual edits: { [article]: {hidden,priceRetail,priceOpt,photo,name} }
  pricelist: '_shop/pricelist', // imported from price xlsx: { [article]: {name,volume,barcode,perBox,pallet,priceRetail,priceOpt} }
  orders: '_shop/orders',       // { seq, list:[order] }
  settings: '_shop/settings',   // non-secret store settings
  leads: '_shop/leads',         // заявки на прайс с лендингов { seq, list:[lead] }
}

// Normalise an article/vendorCode/offer_id into a stable dedup key.
export const artKey = (s) => String(s == null ? '' : s).toUpperCase().replace(/\s+/g, '').trim()

export const DEFAULT_SETTINGS = {
  store: {
    name: 'КубаньБытХим',
    about: 'Эко-бытовая химия оптом и в розницу. Концентраты, объём 1–5 л.',
    contact: '',
  },
  currency: 'RUB',
  minOrder: 0,
  optDiscountPct: 18,   // розничная → оптовая, если опт-цена не задана вручную
  optThreshold: 0,      // от какой суммы доступен опт-режим (0 = всегда)
  delivery: [
    { id: 'pickup', label: 'Самовывоз', price: 0 },
    { id: 'cdek', label: 'СДЭК до ПВЗ', price: 0 },
  ],
  adminChatId: '',      // куда слать заказы (узнаётся ботом по /start)
}

// A small built-in catalog so the storefront renders before the first sync.
export const DEMO_CATALOG = [
  { article: 'KBH-ANTIGREASE-5', name: 'Антижир концентрат', volume: '5 л', barcode: '', perBox: '4', pallet: '', priceRetail: 390, priceOpt: 320, stock: 48, photo: '', sources: { demo: true } },
  { article: 'KBH-FLOOR-1', name: 'Средство для пола', volume: '1 л', barcode: '', perBox: '12', pallet: '', priceRetail: 149, priceOpt: 120, stock: 120, photo: '', sources: { demo: true } },
  { article: 'KBH-GLASS-05', name: 'Для стёкол и зеркал', volume: '0.5 л', barcode: '', perBox: '15', pallet: '', priceRetail: 119, priceOpt: 95, stock: 64, photo: '', sources: { demo: true } },
  { article: 'KBH-UNIVERSAL-1', name: 'Универсальное чистящее', volume: '1 л', barcode: '', perBox: '12', pallet: '', priceRetail: 159, priceOpt: 129, stock: 80, photo: '', sources: { demo: true } },
  { article: 'KBH-SOAP-5', name: 'Жидкое мыло', volume: '5 л', barcode: '', perBox: '4', pallet: '', priceRetail: 290, priceOpt: 240, stock: 30, photo: '', sources: { demo: true } },
  { article: 'KBH-SANITARY-075', name: 'Для сантехники', volume: '0.75 л', barcode: '', perBox: '12', pallet: '', priceRetail: 139, priceOpt: 110, stock: 52, photo: '', sources: { demo: true } },
]

// ── Telegram Bot API ──
export const botToken = () => process.env.TG_BOT_TOKEN || ''
export const providerToken = () => process.env.TG_PROVIDER_TOKEN || ''
export const paymentsEnabled = () => !!(botToken() && providerToken())

export async function tg(method, payload) {
  const token = botToken()
  if (!token) return { ok: false, error: 'no_token' }
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    return await r.json().catch(() => ({ ok: false }))
  } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
}

// Validate Telegram WebApp initData (HMAC over sorted params, secret = HMAC_SHA256("WebAppData", botToken)).
// Returns { user, authDate } when valid, null otherwise. With no bot token configured we accept
// (demo/dev) and return { user:null, demo:true } so the store still works before go-live.
export function validateInitData(initData) {
  const token = botToken()
  if (!token) return { user: null, demo: true }
  if (!initData) return null
  let params
  try { params = new URLSearchParams(initData) } catch { return null }
  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')
  const dcs = [...params.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(token).digest()
  const calc = createHmac('sha256', secret).update(dcs).digest('hex')
  if (calc !== hash) return null
  let user = null
  try { user = params.get('user') ? JSON.parse(params.get('user')) : null } catch { /* ignore */ }
  return { user, authDate: +params.get('auth_date') || 0 }
}

export function readBody(req) {
  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  return body || {}
}

export const rub = (n) => Math.round(+n || 0).toLocaleString('ru-RU') + ' ₽'
