import React, { useCallback, useEffect, useRef, useState } from 'react'
import { parsePriceXlsx } from '../../lib/parseXlsx'

const rub = (n) => Math.round(+n || 0).toLocaleString('ru-RU') + ' ₽'
const artKey = (s) => String(s == null ? '' : s).toUpperCase().replace(/\s+/g, '').trim()
const TABS = [
  { id: 'catalog', label: 'Каталог' },
  { id: 'orders', label: 'Заказы' },
  { id: 'settings', label: 'Настройки' },
]
const STATUS = { new: 'Новый', paid: 'Оплачен', shipped: 'Отгружен', done: 'Завершён', cancelled: 'Отменён' }
const DEFAULT_SETTINGS = {
  store: { name: 'КубаньБытХим', about: 'Эко-бытовая химия оптом и в розницу.', contact: '' },
  currency: 'RUB', minOrder: 0, optDiscountPct: 18, optThreshold: 0, adminChatId: '',
  delivery: [{ id: 'pickup', label: 'Самовывоз', price: 0 }, { id: 'cdek', label: 'СДЭК до ПВЗ', price: 0 }],
}

export default function ShopAdmin() {
  const [tab, setTab] = useState('catalog')
  return (
    <>
      <h1 className="page-title">Магазин</h1>
      <p className="page-sub">Telegram-витрина: каталог из WB+Ozon и прайса, заказы и настройки. Витрина открывается в Telegram, админка — здесь.</p>
      <div className="oz-chips" style={{ marginBottom: 16 }}>
        {TABS.map((t) => (
          <button key={t.id} className={'oz-chip' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
        <a className="btn ghost" href="/shop" target="_blank" rel="noreferrer" style={{ marginLeft: 'auto' }}>↗ Открыть витрину</a>
      </div>
      {tab === 'catalog' && <CatalogTab />}
      {tab === 'orders' && <OrdersTab />}
      {tab === 'settings' && <SettingsTab />}
    </>
  )
}

function CatalogTab() {
  const [items, setItems] = useState([])
  const [overrides, setOverrides] = useState({})
  const [meta, setMeta] = useState({ updatedAt: null, demo: false, pricelist: 0 })
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    const [c, p] = await Promise.all([
      fetch('/api/shop/admin/catalog').then((r) => r.json()).catch(() => ({})),
      fetch('/api/shop/admin/pricelist').then((r) => r.json()).catch(() => ({})),
    ])
    setItems(c.items || [])
    setOverrides(c.overrides || {})
    setMeta({ updatedAt: c.updatedAt, demo: c.demo, pricelist: p.count || 0 })
  }, [])
  useEffect(() => { load() }, [load])

  const sync = async () => {
    setBusy('sync'); setMsg('')
    try {
      const r = await fetch('/api/shop/admin/sync', { method: 'POST' })
      const j = await r.json()
      if (r.ok) { setMsg(`Готово: ${j.count} товаров. ${(j.notes || []).join(' · ')}`); await load() }
      else setMsg('Ошибка: ' + (j.message || j.error))
    } catch (e) { setMsg('Сеть: ' + e) }
    setBusy('')
  }

  const importPrice = async (file) => {
    if (!file) return
    setBusy('price'); setMsg('Читаю прайс…')
    try {
      const { rows } = await parsePriceXlsx(file)
      const map = {}
      for (const r of rows) {
        const k = artKey(r.sku)
        if (!k) continue
        map[k] = { name: r.name, volume: r.volume, barcode: r.barcode, perBox: r.perBox, pallet: r.pallet, section: r.section, priceRetail: r.price, priceOpt: 0 }
      }
      const res = await fetch('/api/shop/admin/pricelist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ map }) })
      const j = await res.json()
      setMsg(res.ok ? `Прайс загружен: ${j.count} позиций. Нажмите «Синхронизировать», чтобы пересобрать каталог.` : 'Ошибка: ' + (j.message || j.error))
      await load()
    } catch (e) { setMsg('Не удалось разобрать файл: ' + (e.message || e)) }
    setBusy('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const setOv = (article, patch) => setOverrides((o) => ({ ...o, [article]: { ...(o[article] || {}), ...patch } }))
  const saveOverrides = async () => {
    setBusy('save'); setMsg('')
    try {
      const r = await fetch('/api/shop/admin/catalog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ overrides }) })
      setMsg(r.ok ? 'Изменения сохранены и применены к витрине.' : 'Ошибка сохранения')
      await load()
    } catch (e) { setMsg('Сеть: ' + e) }
    setBusy('')
  }

  const eff = (it) => {
    const o = overrides[it.article] || {}
    return {
      hidden: o.hidden != null ? o.hidden : !!it.hidden,
      retail: o.priceRetail != null && o.priceRetail !== '' ? o.priceRetail : it.priceRetail,
      opt: o.priceOpt != null && o.priceOpt !== '' ? o.priceOpt : it.priceOpt,
    }
  }

  return (
    <>
      <div className="card sa-actions">
        <button className="btn" onClick={sync} disabled={!!busy}>{busy === 'sync' ? 'Синхронизирую…' : '↻ Синхронизировать WB + Ozon'}</button>
        <button className="btn ghost" onClick={() => fileRef.current?.click()} disabled={!!busy}>{busy === 'price' ? 'Загружаю…' : '↑ Импорт прайса (xlsx)'}</button>
        <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={(e) => importPrice(e.target.files?.[0])} />
        <span className="sa-meta">
          {meta.demo ? 'Каталог ещё не собран (показывается демо).' : `Собрано ${items.length} · ${meta.updatedAt ? new Date(meta.updatedAt).toLocaleString('ru-RU') : ''}`}
          {meta.pricelist ? ` · прайс: ${meta.pricelist}` : ' · прайс не загружен'}
        </span>
      </div>
      {msg && <div className="card oz-msg"><p style={{ margin: 0 }}>{msg}</p></div>}

      <div className="card oz-tablewrap">
        <table className="oz-table sa-table">
          <thead><tr>
            <th>Фото</th><th>Товар</th><th>Источник</th><th className="r">Розница</th><th className="r">Опт</th><th className="r">Остаток</th><th className="r">Витрина</th>
          </tr></thead>
          <tbody>
            {items.map((it) => {
              const e = eff(it)
              const src = it.sources || {}
              return (
                <tr key={it.article} style={e.hidden ? { opacity: 0.45 } : undefined}>
                  <td>{it.photo ? <img src={it.photo} alt="" className="sa-thumb" /> : <span className="sa-thumb sa-noimg">—</span>}</td>
                  <td><div className="oz-name">{it.name}</div><div className="oz-sku">арт. {it.article}{it.volume ? ` · ${it.volume}` : ''}</div></td>
                  <td><span className="sa-src">{[src.price && 'прайс', src.wb && 'WB', src.ozon && 'OZ', src.demo && 'демо'].filter(Boolean).join(' ') || '—'}</span></td>
                  <td className="r"><input className="sa-price" type="number" value={overrides[it.article]?.priceRetail ?? ''} placeholder={String(it.priceRetail || 0)} onChange={(ev) => setOv(it.article, { priceRetail: ev.target.value })} /></td>
                  <td className="r"><input className="sa-price" type="number" value={overrides[it.article]?.priceOpt ?? ''} placeholder={String(it.priceOpt || 0)} onChange={(ev) => setOv(it.article, { priceOpt: ev.target.value })} /></td>
                  <td className="r">{it.stock || 0}</td>
                  <td className="r"><button className={'sa-eye' + (e.hidden ? ' off' : '')} title={e.hidden ? 'Скрыт' : 'Показан'} onClick={() => setOv(it.article, { hidden: !e.hidden })}>{e.hidden ? '🚫' : '👁'}</button></td>
                </tr>
              )
            })}
            {!items.length && <tr><td colSpan={7} className="oz-empty">Каталог пуст. Загрузите прайс и синхронизируйте.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="sa-savebar">
        <span className="sa-meta">Розница/опт — переопределение цены (пусто = из прайса/маркетплейса). Глаз — скрыть/показать в витрине.</span>
        <button className="btn" onClick={saveOverrides} disabled={!!busy}>{busy === 'save' ? 'Сохраняю…' : 'Сохранить изменения'}</button>
      </div>
    </>
  )
}

function OrdersTab() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    try { const j = await fetch('/api/shop/admin/orders').then((r) => r.json()); setOrders(j.orders || []) } catch { /* ignore */ }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const setStatus = async (id, status) => {
    setOrders((o) => o.map((x) => (x.id === id ? { ...x, status } : x)))
    await fetch('/api/shop/admin/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) }).catch(() => {})
  }

  if (loading) return <div className="card oz-msg"><p>Загружаю заказы…</p></div>
  if (!orders.length) return <div className="card oz-msg"><p>Заказов пока нет. Они появятся здесь после оформления в витрине.</p></div>

  return (
    <div className="sa-orders">
      {orders.map((o) => (
        <div className="card sa-order" key={o.id}>
          <div className="sa-order-head">
            <div>
              <span className="sa-order-no">#{o.seq || ''}</span>
              <span className={'sa-badge ' + (o.mode === 'opt' ? 'opt' : 'ret')}>{o.mode === 'opt' ? 'опт' : 'розница'}</span>
              {o.paid && <span className="sa-badge paid">оплачен</span>}
            </div>
            <span className="sa-meta">{new Date(o.createdAt).toLocaleString('ru-RU')}</span>
          </div>
          <div className="sa-order-lines">
            {o.lines.map((l, i) => <div key={i}>{l.name} <span className="oz-sku">×{l.qty}</span> — {rub(l.sum)}</div>)}
          </div>
          <div className="sa-order-foot">
            <div className="sa-cust">
              {o.customer?.name && <span>{o.customer.name}{o.customer.username ? ` @${o.customer.username}` : ''}</span>}
              {o.customer?.phone && <span> · {o.customer.phone}</span>}
              <span> · {o.deliveryLabel}</span>
              {o.customer?.comment && <div className="oz-sku">{o.customer.comment}</div>}
            </div>
            <div className="sa-order-total">{rub(o.total)}</div>
          </div>
          <div className="sa-status">
            {Object.entries(STATUS).map(([k, label]) => (
              <button key={k} className={'oz-chip' + (o.status === k ? ' on' : '')} onClick={() => setStatus(o.id, k)}>{label}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function SettingsTab() {
  const [s, setS] = useState(null)
  const [tokens, setTokens] = useState({})
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/shop/admin/settings').then((r) => r.json())
      .then((j) => { setS(j.settings || DEFAULT_SETTINGS); setTokens(j.tokens || {}) })
      .catch(() => setS(DEFAULT_SETTINGS))
  }, [])
  if (!s) return <div className="card oz-msg"><p>Загружаю настройки…</p></div>

  const upd = (patch) => setS((x) => ({ ...x, ...patch }))
  const updStore = (patch) => setS((x) => ({ ...x, store: { ...x.store, ...patch } }))
  const updDelivery = (i, patch) => setS((x) => ({ ...x, delivery: x.delivery.map((d, j) => (j === i ? { ...d, ...patch } : d)) }))
  const addDelivery = () => setS((x) => ({ ...x, delivery: [...x.delivery, { id: 'd' + Date.now().toString(36), label: '', price: 0 }] }))
  const rmDelivery = (i) => setS((x) => ({ ...x, delivery: x.delivery.filter((_, j) => j !== i) }))

  const save = async () => {
    setBusy(true); setMsg('')
    try {
      const r = await fetch('/api/shop/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: s }) })
      const j = await r.json()
      if (r.ok) { setS(j.settings); setMsg('Настройки сохранены.') } else setMsg('Ошибка: ' + (j.message || j.error))
    } catch (e) { setMsg('Сеть: ' + e) }
    setBusy(false)
  }

  const Tok = ({ ok, children }) => <li><span className={'sa-dot ' + (ok ? 'on' : 'off')} />{children} — <b>{ok ? 'подключено' : 'не задано'}</b></li>

  return (
    <>
      <div className="card sa-form">
        <h3 className="oz-h3">Магазин</h3>
        <label>Название</label>
        <input value={s.store.name} onChange={(e) => updStore({ name: e.target.value })} />
        <label>Описание</label>
        <textarea value={s.store.about} onChange={(e) => updStore({ about: e.target.value })} rows={2} />
        <label>Контакт (для клиента)</label>
        <input value={s.store.contact} onChange={(e) => updStore({ contact: e.target.value })} placeholder="@менеджер / телефон" />

        <div className="sa-2col">
          <div><label>Мин. заказ, ₽</label><input type="number" value={s.minOrder} onChange={(e) => upd({ minOrder: e.target.value })} /></div>
          <div><label>Опт-скидка, %</label><input type="number" value={s.optDiscountPct} onChange={(e) => upd({ optDiscountPct: e.target.value })} /></div>
        </div>
        <label>chat_id для заказов <span className="oz-sku">(напишите боту /id, чтобы узнать)</span></label>
        <input value={s.adminChatId} onChange={(e) => upd({ adminChatId: e.target.value })} placeholder="напр. 123456789" />

        <h3 className="oz-h3" style={{ marginTop: 18 }}>Доставка</h3>
        {s.delivery.map((d, i) => (
          <div className="sa-deliv" key={i}>
            <input value={d.label} placeholder="Способ" onChange={(e) => updDelivery(i, { label: e.target.value })} />
            <input type="number" value={d.price} placeholder="₽" onChange={(e) => updDelivery(i, { price: e.target.value })} />
            <button className="sa-eye off" onClick={() => rmDelivery(i)}>✕</button>
          </div>
        ))}
        <button className="btn ghost" onClick={addDelivery}>+ способ доставки</button>

        <div className="sa-savebar" style={{ marginTop: 18 }}>
          {msg && <span className="sa-meta">{msg}</span>}
          <button className="btn" onClick={save} disabled={busy} style={{ marginLeft: 'auto' }}>{busy ? 'Сохраняю…' : 'Сохранить настройки'}</button>
        </div>
      </div>

      <div className="card sa-form">
        <h3 className="oz-h3">Подключения</h3>
        <ul className="sa-tokens">
          <Tok ok={tokens.bot}>Бот Telegram (TG_BOT_TOKEN)</Tok>
          <Tok ok={tokens.provider}>Оплата · ЮKassa (TG_PROVIDER_TOKEN)</Tok>
          <Tok ok={tokens.storage}>Хранилище{tokens.storageMode ? ` · ${tokens.storageMode}` : ''}</Tok>
          <Tok ok={tokens.wb}>Wildberries (WB_TOKEN)</Tok>
          <Tok ok={tokens.ozon}>Ozon (OZON_CLIENT_ID/API_KEY)</Tok>
        </ul>
        <p className="oz-note" style={{ marginTop: 10 }}>
          Токены задаются в переменных окружения Vercel (не в браузере — так безопаснее) и подхватываются после редеплоя.
          Без бота и ЮKassa магазин работает в демо-режиме: заказ оформляется и падает вам, но без онлайн-оплаты.
          Webhook бота: <code>/api/shop/bot</code> — зарегистрируйте через <code>setWebhook</code>.
        </p>
      </div>
    </>
  )
}
