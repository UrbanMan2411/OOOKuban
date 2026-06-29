import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

const MM = 2.83465 // pt per mm
const mm = (v) => v * MM
const WHITE = rgb(1, 1, 1)
const PHONE = '+7 (8617) 60-00-88'

const today = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`
}

const fmtPrice = (p) => (p > 0 ? p.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) : '—')

async function fetchBytes(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`fetch ${url}: ${r.status}`)
  return new Uint8Array(await r.arrayBuffer())
}

// word-wrap text to a max width; returns array of lines
function wrapText(text, font, size, maxW) {
  const words = String(text).split(/\s+/)
  const lines = []
  let cur = ''
  for (const w of words) {
    const cand = cur ? cur + ' ' + w : w
    if (font.widthOfTextAtSize(cand, size) > maxW && cur) { lines.push(cur); cur = w }
    else cur = cand
  }
  if (cur) lines.push(cur)
  return lines
}

/**
 * Shared price-list PDF builder. Layout is identical for every brand; the
 * `brand` config (src/generators/brands.js) supplies palette, assets, header
 * wordmark/logo, title, price-column label, contacts and footer.
 */
export async function buildPdf(rows, options = {}, brand) {
  const P = brand.palette
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)

  const [regBytes, boldBytes] = await Promise.all([
    fetchBytes(`/${brand.dir}/Manrope-Regular.ttf`),
    fetchBytes(`/${brand.dir}/Manrope-Bold.ttf`),
  ])
  const reg = await doc.embedFont(regBytes, { subset: true })
  const bold = await doc.embedFont(boldBytes, { subset: true })
  const logo = brand.logo ? await doc.embedPng(await fetchBytes(`/${brand.dir}/${brand.logo}`)) : null

  // Background watermark: 'default' (bundled), 'none', or a custom data URL.
  const bgOpt = options.bg ?? 'default'
  const bgOpacity = options.bgOpacity ?? 0.1
  let bg = null
  try {
    if (bgOpt === 'default') {
      bg = await doc.embedJpg(await fetchBytes(`/${brand.dir}/bg.jpg`))
    } else if (typeof bgOpt === 'string' && bgOpt.startsWith('data:')) {
      const isPng = bgOpt.startsWith('data:image/png')
      const bytes = Uint8Array.from(atob(bgOpt.split(',')[1]), (ch) => ch.charCodeAt(0))
      bg = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
    }
  } catch { bg = null }

  // embed product images once (dedupe by dataUrl)
  const imgCache = new Map()
  async function embedImg(dataUrl) {
    if (!dataUrl) return null
    if (imgCache.has(dataUrl)) return imgCache.get(dataUrl)
    const isPng = dataUrl.startsWith('data:image/png')
    const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (ch) => ch.charCodeAt(0))
    let img = null
    try { img = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes) } catch { img = null }
    imgCache.set(dataUrl, img)
    return img
  }
  for (const r of rows) r._img = await embedImg(r.image)

  // A4 landscape
  const PW = mm(297), PH = mm(210)
  // Columns (mm) — Фото · Наименование · Объём · Артикул · Штрих-код · В коробе · Паллет · Цена
  const C = { photo: 10, name: 44, vol: 116, sku: 140, barcode: 166, box: 202, pallet: 224, price: 248 }
  const RIGHT = 287
  const nameW = mm(C.vol - C.name - 3)
  const ROW_MIN = mm(16)

  const NAME_SIZE = 8.6, NAME_LEAD = 10.6
  for (const r of rows) {
    r._nameLines = wrapText(r.name, bold, NAME_SIZE, nameW)
    const textH = (r._nameLines.length - 1) * NAME_LEAD + NAME_SIZE
    r._h = Math.max(ROW_MIN, textH + mm(4))
  }

  // Paginate
  const top0 = PH - mm(30)
  const bottomLim = mm(13)
  const SEC_ABOVE = mm(5), SEC_BELOW = mm(1.5)
  const pages = []
  let cur = []
  let y = top0 - mm(8)
  let sec = null
  for (const r of rows) {
    const need = r._h + (r.section !== sec ? SEC_ABOVE + SEC_BELOW : 0)
    if (y - need < bottomLim) { pages.push(cur); cur = []; y = top0 - mm(8); sec = null }
    if (r.section !== sec) { sec = r.section; y -= SEC_ABOVE; cur.push({ kind: 'sec', y, text: r.section }); y -= SEC_BELOW }
    cur.push({ kind: 'row', y, r })
    y -= r._h
  }
  if (cur.length) pages.push(cur)

  pages.forEach((items, pi) => {
    const page = doc.addPage([PW, PH])
    drawBg(page, PW, PH, bg, bgOpacity, P)
    drawHeader(page, PW, PH, logo, reg, bold, brand)
    drawTHead(page, top0, C, RIGHT, reg, bold, P, brand.priceHeader)

    for (const it of items) {
      if (it.kind === 'sec') { drawSection(page, it.y, it.text, C, RIGHT, bold, P); continue }
      const r = it.r
      const rb = it.y - r._h
      const cy = rb + r._h / 2
      page.drawLine({ start: { x: mm(8), y: rb }, end: { x: mm(RIGHT), y: rb }, thickness: 0.3, color: P.line })
      if (r._img) {
        const cw = mm(C.name - C.photo - 3)
        const ch = r._h - mm(4)
        const scale = Math.min(cw / r._img.width, ch / r._img.height)
        const w = r._img.width * scale, h = r._img.height * scale
        page.drawImage(r._img, { x: mm(C.photo) + (cw - w) / 2, y: cy - h / 2, width: w, height: h })
      }
      const n = r._nameLines.length
      const firstBaseline = cy + ((n - 1) * NAME_LEAD) / 2 - NAME_SIZE * 0.25
      r._nameLines.forEach((ln, k) => {
        page.drawText(ln, { x: mm(C.name) + mm(1), y: firstBaseline - k * NAME_LEAD, size: NAME_SIZE, font: bold, color: P.ink })
      })
      const baseS = cy - 8.0 * 0.35
      const cText = (text, a, b, size = 8.0) => {
        const t = String(text ?? '')
        if (!t) return
        const cx = mm((a + b) / 2)
        page.drawText(t, { x: cx - reg.widthOfTextAtSize(t, size) / 2, y: baseS, size, font: reg, color: P.ink7 })
      }
      cText(r.volume, C.vol, C.sku)
      cText(r.sku, C.sku, C.barcode)
      cText(r.barcode, C.barcode, C.box, 7.6)
      cText(r.perBox, C.box, C.pallet)
      cText(r.pallet, C.pallet, C.price)
      const priceCenter = mm((C.price + RIGHT) / 2)
      const priceTxt = fmtPrice(r.price)
      page.drawText(priceTxt, { x: priceCenter - bold.widthOfTextAtSize(priceTxt, 12) / 2, y: cy - 12 * 0.35, size: 12, font: bold, color: P.g7 })
    }

    drawFooter(page, PW, pi + 1, pages.length, reg, P, brand.footer)
  })

  return await doc.save()
}

function drawBg(page, W, H, bg, opacity, P) {
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: P.paper })
  if (bg) {
    const asp = bg.width / bg.height
    let tw = W, th = tw / asp
    if (th < H) { th = H; tw = th * asp }
    page.drawImage(bg, { x: (W - tw) / 2, y: (H - th) / 2, width: tw, height: th, opacity })
  }
  page.drawRectangle({ x: 0, y: H - mm(3.5), width: W, height: mm(3.5), color: P.g9 })
  page.drawRectangle({ x: 0, y: 0, width: W, height: mm(3.5), color: P.g9 })
}

function drawHeader(page, W, H, logo, reg, bold, brand) {
  const P = brand.palette
  const y = H - mm(11)
  if (logo) {
    const lh = mm(11)
    const lw = (logo.width / logo.height) * lh
    page.drawImage(logo, { x: mm(10), y: y - lh + mm(2), width: lw, height: lh })
  } else if (brand.wordmark) {
    page.drawText(brand.wordmark[0], { x: mm(10), y: y - mm(6), size: 21, font: bold, color: P.g9 })
    page.drawText(brand.wordmark[1], { x: mm(10), y: y - mm(10.5), size: 7.5, font: reg, color: P.muted })
  }
  page.drawText(brand.title, { x: W / 2 - bold.widthOfTextAtSize(brand.title, 15) / 2, y: y - mm(3), size: 15, font: bold, color: P.g9 })
  const sub = `ООО «КубаньБытХим» · ИНН 2315984520 · г. Новороссийск · ред. от ${today()}`
  page.drawText(sub, { x: W / 2 - reg.widthOfTextAtSize(sub, 8) / 2, y: y - mm(8), size: 8, font: reg, color: P.muted })
  page.drawText(PHONE, { x: W - mm(10) - bold.widthOfTextAtSize(PHONE, 9.5), y: y - mm(1), size: 9.5, font: bold, color: P.ink })
  page.drawText(brand.mail, { x: W - mm(10) - reg.widthOfTextAtSize(brand.mail, 8), y: y - mm(5.5), size: 8, font: reg, color: P.muted })
}

function drawTHead(page, ymm, C, RIGHT, reg, bold, P, priceHeader) {
  page.drawRectangle({ x: mm(8), y: ymm - mm(6), width: mm(RIGHT - 8), height: mm(7), color: P.g9 })
  const ty = ymm - mm(4)
  const sz = 7.4
  page.drawText('Наименование', { x: mm(C.name) + mm(1), y: ty, size: sz, font: bold, color: WHITE })
  const center = (a, b) => mm((a + b) / 2)
  const dc = (text, cx, size = sz) => page.drawText(text, { x: cx - bold.widthOfTextAtSize(text, size) / 2, y: ty, size, font: bold, color: WHITE })
  dc('Фото', center(C.photo, C.name - 3))
  dc('Объём', center(C.vol, C.sku))
  dc('Артикул', center(C.sku, C.barcode))
  dc('Штрих-код', center(C.barcode, C.box), 7)
  dc('В коробе', center(C.box, C.pallet), 6.8)
  dc('Паллет', center(C.pallet, C.price), 6.8)
  dc(priceHeader[0], center(C.price, RIGHT), priceHeader[1])
}

function drawSection(page, y, title, C, RIGHT, bold, P) {
  const t = '› ' + (title || '').toUpperCase()
  page.drawText(t, { x: mm(10), y, size: 9.5, font: bold, color: P.g7 })
  const tx = mm(10) + bold.widthOfTextAtSize(t, 9.5) + mm(3)
  page.drawLine({ start: { x: tx, y: y + mm(1.4) }, end: { x: mm(RIGHT), y: y + mm(1.4) }, thickness: 0.5, color: P.g5 })
}

function drawFooter(page, W, pi, total, reg, P, footer) {
  page.drawText(footer, { x: mm(10), y: mm(7), size: 7.5, font: reg, color: P.muted })
  const pg = `Стр. ${pi} из ${total}`
  page.drawText(pg, { x: W - mm(10) - reg.widthOfTextAtSize(pg, 7.5), y: mm(7), size: 7.5, font: reg, color: P.muted })
}
