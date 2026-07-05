// POST /api/shop/lead — PUBLIC. Заявка на оптовый прайс с лендингов
// (greenpanda-eco.ru и /matreshka). Сохраняет в _shop/leads и шлёт
// уведомление в тот же админ-чат Telegram, что и заказы магазина.
import { readJson, writeJson, SHOP, DEFAULT_SETTINGS, readBody, tg, botToken } from './_lib.js'

export const config = { maxDuration: 15 }

const ALLOWED_ORIGINS = ['https://greenpanda-eco.ru', 'https://www.greenpanda-eco.ru', 'https://app.greenpanda-eco.ru']
const clip = (s, n) => String(s || '').trim().slice(0, n)

export default async function handler(req, res) {
  const origin = req.headers.origin || ''
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  }
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const body = readBody(req)
  // honeypot: у людей поле скрыто и пустое; боты его заполняют
  if (clip(body.website, 200)) return res.status(200).json({ ok: true })

  const lead = {
    name: clip(body.name, 120),
    phone: clip(body.phone, 40),
    email: clip(body.email, 120),
    biz: clip(body.biz, 120),
    comment: clip(body.comment, 500),
    source: clip(body.source, 60) || 'greenpanda-landing',
    at: new Date().toISOString(),
  }
  if (!lead.name || !lead.phone) {
    return res.status(400).json({ error: 'bad_request', message: 'Укажите имя и телефон.' })
  }

  try {
    const store = (await readJson(SHOP.leads, { seq: 0, list: [] })) || { seq: 0, list: [] }
    lead.seq = (store.seq || 0) + 1
    store.seq = lead.seq
    store.list = [lead, ...(store.list || [])].slice(0, 2000)
    await writeJson(SHOP.leads, store)
  } catch { /* хранилище недоступно — заявку всё равно шлём в чат */ }

  const settings = { ...DEFAULT_SETTINGS, ...(await readJson(SHOP.settings, {}) || {}) }
  if (botToken() && settings.adminChatId) {
    const txt = [
      `📋 Заявка на оптовый прайс #${lead.seq || ''}`,
      `Имя: ${lead.name}`,
      `Тел: ${lead.phone}`,
      lead.email ? `E-mail: ${lead.email}` : '',
      lead.biz ? `Бизнес: ${lead.biz}` : '',
      lead.comment ? `Комментарий: ${lead.comment}` : '',
      `Источник: ${lead.source}`,
    ].filter(Boolean).join('\n')
    try { await tg('sendMessage', { chat_id: settings.adminChatId, text: txt }) }
    catch { /* чат недоступен — заявка сохранена, не роняем ответ */ }
  }

  return res.status(200).json({ ok: true })
}
