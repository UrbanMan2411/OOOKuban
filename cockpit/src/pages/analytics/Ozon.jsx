import React from 'react'
import MarketplaceReport, { rub, int, pct } from './MarketplaceReport'

const CONFIG = {
  endpoint: '/api/ozon/top-sku', apiName: 'Ozon API', scope: '', csvName: 'ozon-top-sku',
  title: 'Озон · топ SKU',
  sub: 'Аналитика продаж из вашего кабинета Ozon Seller: топ товаров по выручке, заказам, показам и конверсии. Данные идут через защищённый прокси — ключ не попадает в браузер.',
  loadingText: 'Загружаю данные Ozon…',
  hint: <>Проверьте, что в Vercel заданы переменные <code>OZON_CLIENT_ID</code> и <code>OZON_API_KEY</code>, и что у ключа есть доступ к разделу «Аналитика».</>,
  rowKey: (r, i) => r.sku || i,
  stats: (t) => [
    { label: `Выручка (топ-${t.skuCount})`, value: rub(t.revenue) },
    { label: 'Заказов, шт', value: int(t.units) },
    { label: 'Средний чек', value: rub(t.units > 0 ? t.revenue / t.units : 0) },
    { label: 'SKU в выборке', value: int(t.skuCount) },
  ],
  bar: { name: (r) => r.name || r.sku, title: (r) => r.name },
  columns: [
    { header: '#', tdCls: 'oz-rank', render: (r, i) => i + 1 },
    { header: 'Товар', render: (r) => <><div className="oz-name">{r.name || '—'}</div><div className="oz-sku">SKU {r.sku}</div></> },
    { header: 'Выручка', thCls: 'r', tdCls: 'r oz-rev', render: (r) => rub(r.revenue) },
    { header: 'Заказы', thCls: 'r', tdCls: 'r', render: (r) => int(r.units) },
    { header: 'Средний чек', thCls: 'r', tdCls: 'r', render: (r) => rub(r.avgCheck) },
    { header: 'Доля выручки', thCls: 'r', tdCls: 'r', render: (r, i, t) => pct(t && t.revenue > 0 ? (r.revenue / t.revenue) * 100 : 0) },
  ],
  note: 'Ozon Seller API отдаёт по SKU выручку и заказы. Показы и конверсия доступны только на тарифе Ozon Premium Plus — при подключении добавлю колонки воронки.',
  csv: (rows, t) => {
    const tot = (t && t.revenue) || 1
    return {
      head: ['Ранг', 'SKU', 'Наименование', 'Выручка ₽', 'Заказы', 'Средний чек ₽', 'Доля выручки'],
      rows: rows.map((r, i) => [i + 1, r.sku, `"${(r.name || '').replace(/"/g, '""')}"`, Math.round(r.revenue), r.units, Math.round(r.avgCheck), ((r.revenue / tot) * 100).toFixed(1) + '%']),
    }
  },
}

export default function Ozon() { return <MarketplaceReport config={CONFIG} /> }
