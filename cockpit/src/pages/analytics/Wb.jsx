import React from 'react'
import MarketplaceReport, { rub, int, pct, shorten } from './MarketplaceReport'

const CONFIG = {
  endpoint: '/api/wb/top-sku', apiName: 'WB API', scope: 'wb-scope', csvName: 'wb-top-sku',
  title: 'Wildberries · топ SKU',
  sub: 'Воронка продаж по карточкам из кабинета WB: показы → корзина → заказы → выкупы, выручка и конверсии по каждому SKU. Запрос идёт через защищённый прокси — токен не попадает в браузер.',
  loadingText: 'Загружаю данные Wildberries…',
  hint: <>Проверьте, что в Vercel задана переменная <code>WB_TOKEN</code> с доступом к категории «Аналитика». У эндпоинта воронки лимит ~3 запроса/мин — при ошибке 429 подождите минуту.</>,
  rowKey: (r, i) => r.nmId || i,
  stats: (t) => [
    { label: `Выручка заказов (топ-${t.skuCount})`, value: rub(t.revenue) },
    { label: 'Заказов, шт', value: int(t.orders) },
    { label: 'Показы карточек', value: int(t.views) },
    { label: 'SKU в выборке', value: int(t.skuCount) },
  ],
  bar: { name: (r) => shorten(r.title || r.vendorCode || r.nmId), title: (r) => `${r.title || ''} · арт. ${r.vendorCode || r.nmId}` },
  columns: [
    { header: '#', tdCls: 'oz-rank', render: (r, i) => i + 1 },
    { header: 'Товар', render: (r) => <><div className="oz-name">{r.vendorCode || '—'}{r.brand ? ` · ${r.brand}` : ''}</div><div className="oz-sku">nmID {r.nmId}{r.subject ? ` · ${r.subject}` : ''}</div></> },
    { header: 'Показы', thCls: 'r', tdCls: 'r', render: (r) => int(r.views) },
    { header: 'В корзину', thCls: 'r', tdCls: 'r', render: (r) => int(r.cart) },
    { header: 'Заказы', thCls: 'r', tdCls: 'r', render: (r) => int(r.orders) },
    { header: 'Выручка', thCls: 'r', tdCls: 'r oz-rev', render: (r) => rub(r.revenue) },
    { header: 'Конв. в заказ', thCls: 'r', tdCls: 'r', render: (r) => pct(r.convOrder) },
    { header: 'Выкуп %', thCls: 'r', tdCls: 'r', render: (r) => pct(r.buyoutPct) },
  ],
  csv: (rows) => ({
    head: ['Ранг', 'nmID', 'Артикул', 'Бренд', 'Предмет', 'Показы', 'В корзину', 'Заказы', 'Выручка ₽', 'Выкупы', 'Конв. в корзину', 'Конв. в заказ', 'Выкуп %'],
    rows: rows.map((r, i) => [i + 1, r.nmId, `"${(r.vendorCode || '').replace(/"/g, '""')}"`, `"${(r.brand || '').replace(/"/g, '""')}"`, `"${(r.subject || '').replace(/"/g, '""')}"`, r.views, r.cart, r.orders, Math.round(r.revenue), r.buyouts, pct(r.convCart), pct(r.convOrder), pct(r.buyoutPct)]),
  }),
}

export default function Wb() { return <MarketplaceReport config={CONFIG} /> }
