// POST /api/shop/order — PUBLIC. Creates an order from the storefront.
// Validates Telegram initData (when a bot token is configured), records the
// order in Blob, notifies the admin chat, and — if Telegram Payments are
// configured — returns an invoice link for tg.openInvoice(). Otherwise it
// completes in "demo" mode (order accepted, you contact the buyer).
import { readJson, writeJson, SHOP, DEFAULT_SETTINGS, validateInitData, readBody, tg, botToken, providerToken, paymentsEnabled, rub } from './_lib.js'

export const config = { maxDuration: 30 }

const nowIso = () => new Date().toISOString()

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const body = readBody(req)
  const auth = validateInitData(body.initData || '')
  if (!auth) return res.status(401).json({ error: 'bad_init_data', message: 'Не удалось подтвердить вход через Telegram.' })

  const items = Array.isArray(body.items) ? body.items : []
  if (!items.length) return res.status(400).json({ error: 'empty_cart', message: 'Корзина пуста.' })

  const settings = { ...DEFAULT_SETTINGS, ...(await readJson(SHOP.settings, {}) || {}) }
  const mode = body.mode === 'opt' ? 'opt' : 'retail'

  // Trust prices from the saved catalog, not the client.
  const built = await readJson(SHOP.catalog, null)
  const byArt = new Map(((built && built.items) || []).map((p) => [p.article, p]))
  const disc = Math.max(0, Math.min(90, +settings.optDiscountPct || 0))
  let goods = 0
  const lines = items.map((it) => {
    const p = byArt.get(it.article)
    const qty = Math.max(1, Math.round(+it.qty || 1))
    let unit
    if (p) {
      const retail = Math.round(+p.priceRetail || 0)
      unit = mode === 'opt'
        ? (p.priceOpt > 0 ? Math.round(+p.priceOpt) : Math.max(1, Math.round(retail * (1 - disc / 100))))
        : retail
    } else {
      unit = Math.max(0, Math.round(+it.price || 0)) // demo catalog fallback (no Blob)
    }
    goods += unit * qty
    return { article: it.article, name: (p && p.name) || it.name || it.article, qty, unit, sum: unit * qty }
  })

  const deliveryId = body.delivery || (settings.delivery[0] && settings.delivery[0].id) || 'pickup'
  const delivery = (settings.delivery || []).find((d) => d.id === deliveryId) || { id: deliveryId, label: deliveryId, price: 0 }
  const total = goods + (Math.round(+delivery.price || 0))

  if ((+settings.minOrder || 0) > 0 && goods < +settings.minOrder) {
    return res.status(400).json({ error: 'below_min', message: `Минимальный заказ — ${rub(settings.minOrder)}.` })
  }

  const user = auth.user || {}
  const order = {
    id: 'o_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    createdAt: nowIso(),
    status: 'new',
    mode, lines, goods, deliveryLabel: delivery.label, deliveryPrice: Math.round(+delivery.price || 0), total,
    customer: {
      tgId: user.id || null,
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || (body.contact && body.contact.name) || '',
      username: user.username || '',
      phone: (body.contact && body.contact.phone) || '',
      comment: (body.contact && body.contact.comment) || '',
    },
    paid: false,
  }

  // Persist (best-effort; demo/dev without Blob still returns ok).
  try {
    const store = (await readJson(SHOP.orders, { seq: 0, list: [] })) || { seq: 0, list: [] }
    order.seq = (store.seq || 0) + 1
    store.seq = order.seq
    store.list = [order, ...(store.list || [])].slice(0, 1000)
    await writeJson(SHOP.orders, store)
  } catch { /* no blob → skip persistence */ }

  // Notify admin chat (if bot + chat known).
  if (botToken() && settings.adminChatId) {
    const txt = [
      `🛒 Новый заказ #${order.seq || ''} (${mode === 'opt' ? 'опт' : 'розница'})`,
      ...lines.map((l) => `• ${l.name} ×${l.qty} — ${rub(l.sum)}`),
      `Доставка: ${order.deliveryLabel} ${order.deliveryPrice ? rub(order.deliveryPrice) : ''}`.trim(),
      `Итого: ${rub(total)}`,
      order.customer.name ? `Клиент: ${order.customer.name}${order.customer.username ? ' @' + order.customer.username : ''}` : '',
      order.customer.phone ? `Тел: ${order.customer.phone}` : '',
      order.customer.comment ? `Комментарий: ${order.customer.comment}` : '',
    ].filter(Boolean).join('\n')
    await tg('sendMessage', { chat_id: settings.adminChatId, text: txt })
  }

  // Payments configured → return an invoice link for tg.openInvoice().
  if (paymentsEnabled() && total > 0) {
    const inv = await tg('createInvoiceLink', {
      title: `Заказ ${settings.store.name}`.slice(0, 32),
      description: lines.map((l) => `${l.name}×${l.qty}`).join(', ').slice(0, 255) || 'Заказ',
      payload: order.id,
      provider_token: providerToken(),
      currency: settings.currency || 'RUB',
      prices: [{ label: 'Заказ', amount: total * 100 }], // kopecks
    })
    if (inv && inv.ok && inv.result) {
      return res.status(200).json({ ok: true, orderId: order.id, seq: order.seq, total, invoiceUrl: inv.result })
    }
    // fall through to demo response if invoice creation failed
  }

  return res.status(200).json({ ok: true, orderId: order.id, seq: order.seq, total, demo: true })
}
