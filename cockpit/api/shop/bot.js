// POST /api/shop/bot — Telegram webhook. PUBLIC, but optionally protected by a
// secret header (set TG_WEBHOOK_SECRET and pass it when registering the webhook).
// Handles:
//   /start          → greet + button that opens the Mini App storefront
//   pre_checkout_query → approve
//   successful_payment → mark the order paid, notify admin
// GET shows quick setup help (and registers nothing — registration is manual).
import { readJson, writeJson, SHOP, DEFAULT_SETTINGS, readBody, tg, botToken } from './_lib.js'

export const config = { maxDuration: 30 }

const shopUrl = (req) => {
  if (process.env.SHOP_URL) return process.env.SHOP_URL
  const host = req.headers['x-forwarded-host'] || req.headers.host
  return host ? `https://${host}/shop` : ''
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const url = shopUrl(req)
    return res.status(200).json({
      ok: true,
      hint: 'Это webhook Telegram-бота. Зарегистрируйте его: setWebhook → ' +
        `https://api.telegram.org/bot<TOKEN>/setWebhook?url=${encodeURIComponent((req.headers['x-forwarded-host'] ? 'https://' + req.headers['x-forwarded-host'] : '') + '/api/shop/bot')}`,
      storefront: url, botConfigured: !!botToken(),
    })
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  // Optional shared-secret check.
  if (process.env.TG_WEBHOOK_SECRET) {
    const got = req.headers['x-telegram-bot-api-secret-token']
    if (got !== process.env.TG_WEBHOOK_SECRET) return res.status(401).json({ ok: false })
  }
  if (!botToken()) return res.status(200).json({ ok: true }) // nothing to do yet

  const upd = readBody(req)
  try {
    const msg = upd.message

    // Bot added to a group → reply with the group's chat_id so it can be set
    // as the order-notifications target (Настройки → «chat_id для заказов»).
    if (msg && Array.isArray(msg.new_chat_members)) {
      const me = botToken().split(':')[0]
      if (me && msg.new_chat_members.some((m) => String(m.id) === me)) {
        await tg('sendMessage', { chat_id: msg.chat.id, text: `Группа подключена ✅\nchat_id этой группы: \`${msg.chat.id}\`\nВставьте его в настройках магазина → «chat_id для заказов» — и сюда будут приходить уведомления о заказах.`, parse_mode: 'Markdown' })
        return res.status(200).json({ ok: true })
      }
    }

    // /start → open-shop button
    if (msg && typeof msg.text === 'string' && msg.text.startsWith('/start')) {
      const url = shopUrl(req)
      const s = { ...DEFAULT_SETTINGS, ...(await readJson(SHOP.settings, {}) || {}) }
      await tg('sendMessage', {
        chat_id: msg.chat.id,
        text: `Добро пожаловать в магазин «${s.store.name}»! Откройте каталог кнопкой ниже.`,
        reply_markup: url ? { inline_keyboard: [[{ text: '🛍 Открыть магазин', web_app: { url } }]] } : undefined,
      })
      return res.status(200).json({ ok: true })
    }

    // /id helper → tells the admin their chat id (to paste into settings)
    if (msg && typeof msg.text === 'string' && msg.text.startsWith('/id')) {
      await tg('sendMessage', { chat_id: msg.chat.id, text: `Ваш chat_id: ${msg.chat.id}\nВставьте его в настройках магазина (куда слать заказы).` })
      return res.status(200).json({ ok: true })
    }

    // payment flow
    if (upd.pre_checkout_query) {
      await tg('answerPreCheckoutQuery', { pre_checkout_query_id: upd.pre_checkout_query.id, ok: true })
      return res.status(200).json({ ok: true })
    }
    if (msg && msg.successful_payment) {
      const orderId = msg.successful_payment.invoice_payload
      try {
        const store = (await readJson(SHOP.orders, { seq: 0, list: [] })) || { seq: 0, list: [] }
        const o = (store.list || []).find((x) => x.id === orderId)
        if (o) { o.paid = true; o.status = 'paid'; o.paidAt = new Date().toISOString(); await writeJson(SHOP.orders, store) }
        const s = { ...DEFAULT_SETTINGS, ...(await readJson(SHOP.settings, {}) || {}) }
        if (s.adminChatId) await tg('sendMessage', { chat_id: s.adminChatId, text: `✅ Оплачен заказ #${(o && o.seq) || ''} на ${(o && o.total) || ''} ₽` })
      } catch { /* ignore */ }
      await tg('sendMessage', { chat_id: msg.chat.id, text: 'Спасибо! Оплата получена, заказ принят в работу.' })
      return res.status(200).json({ ok: true })
    }
  } catch { /* swallow — Telegram retries on non-200, we don't want loops */ }
  return res.status(200).json({ ok: true })
}
