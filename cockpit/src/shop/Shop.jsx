import React, { useEffect, useMemo, useState } from 'react'

const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null
const rub = (n) => Math.round(+n || 0).toLocaleString('ru-RU') + ' ₽'

// Shown only if the catalog API is unreachable (offline / not yet deployed),
// so the storefront degrades to a preview instead of a dead screen.
const FALLBACK = {
  items: [
    { article: 'KBH-ANTIGREASE-5', name: 'Антижир концентрат', volume: '5 л', perBox: '4', priceRetail: 390, priceOpt: 320, stock: 48, photo: '', section: 'Кухня' },
    { article: 'KBH-FLOOR-1', name: 'Средство для пола', volume: '1 л', perBox: '12', priceRetail: 149, priceOpt: 120, stock: 120, photo: '', section: 'Полы' },
    { article: 'KBH-GLASS-05', name: 'Для стёкол и зеркал', volume: '0.5 л', perBox: '15', priceRetail: 119, priceOpt: 95, stock: 64, photo: '', section: 'Стекло' },
    { article: 'KBH-UNIVERSAL-1', name: 'Универсальное чистящее', volume: '1 л', perBox: '12', priceRetail: 159, priceOpt: 129, stock: 80, photo: '', section: 'Универсальные' },
  ],
  settings: { store: { name: 'КубаньБытХим', about: 'Эко-бытовая химия оптом и в розницу.' }, currency: 'RUB', minOrder: 0, optDiscountPct: 18, delivery: [{ id: 'pickup', label: 'Самовывоз', price: 0 }], paymentsEnabled: false, demo: true },
}

// Persist cart per-session so a reload inside Telegram doesn't lose it.
const CART_KEY = 'kbh.shop.cart'
const loadCart = () => { try { return JSON.parse(sessionStorage.getItem(CART_KEY)) || {} } catch { return {} } }
const saveCart = (c) => { try { sessionStorage.setItem(CART_KEY, JSON.stringify(c)) } catch { /* ignore */ } }

export default function Shop() {
  const [data, setData] = useState({ status: 'loading', items: [], settings: null, error: '' })
  const [view, setView] = useState({ name: 'catalog' }) // catalog | product | cart | checkout | done
  const [mode, setMode] = useState('retail') // retail | opt
  const [q, setQ] = useState('')
  const [section, setSection] = useState('')
  const [cart, setCart] = useState(loadCart)
  const [contact, setContact] = useState({ name: '', phone: '', comment: '' })
  const [delivery, setDelivery] = useState('')
  const [placing, setPlacing] = useState(false)

  useEffect(() => { saveCart(cart) }, [cart])

  useEffect(() => {
    fetch('/api/shop/catalog').then((r) => r.json()).then((j) => {
      setData({ status: 'ready', items: j.items || [], settings: j.settings || {}, error: '' })
      const d = j.settings?.delivery?.[0]?.id
      if (d) setDelivery(d)
      const u = tg?.initDataUnsafe?.user
      if (u) setContact((c) => ({ ...c, name: [u.first_name, u.last_name].filter(Boolean).join(' ') || c.name }))
    }).catch(() => {
      setData({ status: 'ready', items: FALLBACK.items, settings: FALLBACK.settings, error: '' })
      setDelivery(FALLBACK.settings.delivery[0].id)
    })
  }, [])

  const sections = useMemo(() => {
    const set = new Set()
    data.items.forEach((p) => p.section && set.add(p.section))
    return [...set]
  }, [data.items])

  const priceOf = (p) => (mode === 'opt' ? p.priceOpt : p.priceRetail)

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return data.items.filter((p) =>
      (!section || p.section === section) &&
      (!needle || (p.name + ' ' + p.article).toLowerCase().includes(needle)))
  }, [data.items, q, section])

  const cartLines = useMemo(() =>
    Object.entries(cart).map(([article, qty]) => {
      const p = data.items.find((x) => x.article === article)
      return p ? { ...p, qty, unit: priceOf(p), sum: priceOf(p) * qty } : null
    }).filter(Boolean), [cart, data.items, mode])

  const goods = cartLines.reduce((s, l) => s + l.sum, 0)
  const cartCount = Object.values(cart).reduce((s, n) => s + n, 0)
  const deliveryObj = (data.settings?.delivery || []).find((d) => d.id === delivery) || { price: 0, label: '' }
  const total = goods + (deliveryObj.price || 0)
  const minOrder = data.settings?.minOrder || 0

  const setQty = (article, qty) => setCart((c) => {
    const next = { ...c }
    if (qty <= 0) delete next[article]; else next[article] = qty
    return next
  })

  const place = async () => {
    setPlacing(true)
    try {
      const r = await fetch('/api/shop/order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: tg?.initData || '', mode, delivery,
          items: cartLines.map((l) => ({ article: l.article, qty: l.qty, name: l.name, price: l.unit })),
          contact,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { alert(j.message || 'Не удалось оформить заказ'); setPlacing(false); return }
      if (j.invoiceUrl && tg?.openInvoice) {
        tg.openInvoice(j.invoiceUrl, (status) => {
          setPlacing(false)
          if (status === 'paid') { setCart({}); setView({ name: 'done', paid: true }) }
        })
        return
      }
      setCart({}); setView({ name: 'done', paid: false, seq: j.seq })
    } catch (e) { alert('Сеть недоступна: ' + e); }
    setPlacing(false)
  }

  if (data.status === 'loading') return <div className="sh-empty">Загрузка каталога…</div>
  if (data.status === 'error') return <div className="sh-empty">Не удалось загрузить магазин.<br />{data.error}</div>

  const store = data.settings?.store || {}
  const product = view.name === 'product' ? data.items.find((p) => p.article === view.article) : null

  // ── DONE ──
  if (view.name === 'done') return (
    <div className="sh-done">
      <div className="ic"><i className="ti ti-circle-check" /></div>
      <h2>{view.paid ? 'Оплачено!' : 'Заказ принят'}</h2>
      <p>{view.paid ? 'Спасибо за покупку. Мы уже собираем заказ.' : `Заказ ${view.seq ? '#' + view.seq + ' ' : ''}принят. Мы свяжемся с вами для подтверждения.`}</p>
      <button className="sh-cta" style={{ maxWidth: 260, margin: '24px auto 0' }} onClick={() => setView({ name: 'catalog' })}>В каталог</button>
    </div>
  )

  // ── PRODUCT ──
  if (product) {
    const inCart = cart[product.article] || 0
    return (
      <>
        <button className="sh-back" onClick={() => setView({ name: 'catalog' })}><i className="ti ti-chevron-left" /> Назад</button>
        <div className="sh-p-img">{product.photo ? <img src={product.photo} alt="" /> : <i className="ti ti-photo ph-ic" style={{ fontSize: 40 }} />}</div>
        <div className="sh-p-body">
          <div className="sh-p-name">{product.name}</div>
          <div className="sh-p-meta">{[product.volume, 'арт. ' + product.article].filter(Boolean).join(' · ')}</div>
          <div className="sh-p-price">{rub(priceOf(product))}{mode === 'retail' && product.priceOpt < product.priceRetail && <span style={{ fontSize: 13, color: 'var(--hint)', fontWeight: 400, marginLeft: 8 }}>опт от {rub(product.priceOpt)}</span>}</div>
          <div className={'sh-stock ' + (product.stock > 0 ? 'in' : 'out')}>{product.stock > 0 ? 'В наличии' : 'Под заказ'}</div>
          <div className="sh-p-spec">
            {product.volume && <div><span>Объём</span><span>{product.volume}</span></div>}
            {product.perBox && <div><span>В коробе</span><span>{product.perBox} шт</span></div>}
            {product.pallet && <div><span>На паллете</span><span>{product.pallet}</span></div>}
            {product.barcode && <div><span>Штрих-код</span><span>{product.barcode}</span></div>}
          </div>
        </div>
        <div className="sh-bar"><div className="sh-bar-inner">
          {inCart > 0 ? (
            <div className="sh-qty" style={{ height: 50 }}>
              <button onClick={() => setQty(product.article, inCart - 1)}>−</button>
              <span>{inCart} шт в корзине</span>
              <button onClick={() => setQty(product.article, inCart + 1)}>+</button>
            </div>
          ) : (
            <button className="sh-cta" onClick={() => setQty(product.article, 1)}><i className="ti ti-shopping-cart-plus" /> В корзину · {rub(priceOf(product))}</button>
          )}
        </div></div>
      </>
    )
  }

  // ── CART / CHECKOUT ──
  if (view.name === 'cart' || view.name === 'checkout') {
    if (!cartLines.length) return (
      <>
        <button className="sh-back" onClick={() => setView({ name: 'catalog' })}><i className="ti ti-chevron-left" /> Назад</button>
        <div className="sh-empty"><i className="ti ti-shopping-cart" style={{ fontSize: 40, display: 'block', marginBottom: 10 }} />Корзина пуста</div>
      </>
    )
    const checkout = view.name === 'checkout'
    const belowMin = minOrder > 0 && goods < minOrder
    return (
      <>
        <button className="sh-back" onClick={() => setView({ name: checkout ? 'cart' : 'catalog' })}><i className="ti ti-chevron-left" /> Назад</button>
        <div className="sh-h">{checkout ? 'Оформление' : 'Корзина'}</div>
        {cartLines.map((l) => (
          <div className="sh-line" key={l.article}>
            <div className="th">{l.photo ? <img src={l.photo} alt="" /> : <i className="ti ti-photo ph-ic" />}</div>
            <div className="info">
              <div className="nm">{l.name}</div>
              <div className="pr">{rub(l.unit)} × {l.qty} = {rub(l.sum)}</div>
            </div>
            {checkout ? <span style={{ fontSize: 14, fontWeight: 600 }}>{rub(l.sum)}</span> : (
              <div className="sh-qty" style={{ width: 108 }}>
                <button onClick={() => setQty(l.article, l.qty - 1)}>−</button>
                <span>{l.qty}</span>
                <button onClick={() => setQty(l.article, l.qty + 1)}>+</button>
              </div>
            )}
          </div>
        ))}

        {checkout && (
          <>
            <div className="sh-field">
              <label>Доставка</label>
              <select value={delivery} onChange={(e) => setDelivery(e.target.value)}>
                {(data.settings?.delivery || []).map((d) => <option key={d.id} value={d.id}>{d.label}{d.price ? ` · ${rub(d.price)}` : ' · бесплатно'}</option>)}
              </select>
            </div>
            <div className="sh-field"><label>Имя</label><input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} placeholder="Как к вам обращаться" /></div>
            <div className="sh-field"><label>Телефон</label><input value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} placeholder="+7…" inputMode="tel" /></div>
            <div className="sh-field"><label>Комментарий</label><textarea value={contact.comment} onChange={(e) => setContact({ ...contact, comment: e.target.value })} rows={2} placeholder="Адрес ПВЗ, пожелания" /></div>
          </>
        )}

        <div className="sh-sum">
          <div className="r"><span>Товары ({cartCount})</span><span>{rub(goods)}</span></div>
          {checkout && <div className="r"><span>Доставка</span><span>{deliveryObj.price ? rub(deliveryObj.price) : 'бесплатно'}</span></div>}
          <div className="r total"><span>Итого</span><span>{rub(checkout ? total : goods)}</span></div>
          {belowMin && <div className="sh-note" style={{ color: 'var(--danger)' }}>Минимальный заказ — {rub(minOrder)}</div>}
        </div>

        <div className="sh-bar"><div className="sh-bar-inner">
          {checkout
            ? <button className="sh-cta" disabled={placing || belowMin} onClick={place}><i className="ti ti-credit-card" /> {data.settings?.paymentsEnabled ? `Оплатить ${rub(total)}` : `Оформить заказ · ${rub(total)}`}</button>
            : <button className="sh-cta" disabled={belowMin} onClick={() => setView({ name: 'checkout' })}>Оформить · {rub(goods)}</button>}
        </div></div>
      </>
    )
  }

  // ── CATALOG ──
  return (
    <>
      <div className="sh-top">
        <div className="sh-store">{store.name || 'Магазин'}</div>
        {store.about && <div className="sh-about">{store.about}</div>}
        <input className="sh-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по каталогу" />
        <div className="sh-rowflex">
          <div className="sh-modes">
            <button className={'sh-mode' + (mode === 'retail' ? ' on' : '')} onClick={() => setMode('retail')}>Розница</button>
            <button className={'sh-mode' + (mode === 'opt' ? ' on' : '')} onClick={() => setMode('opt')}>Опт</button>
          </div>
        </div>
      </div>

      {data.settings?.demo && <div className="sh-demo">Демо-каталог. Реальные товары появятся после синхронизации в админке.</div>}

      {sections.length > 0 && (
        <div className="sh-chips">
          <button className={'sh-chip' + (!section ? ' on' : '')} onClick={() => setSection('')}>Все</button>
          {sections.map((s) => <button key={s} className={'sh-chip' + (section === s ? ' on' : '')} onClick={() => setSection(s)}>{s}</button>)}
        </div>
      )}

      <div className="sh-grid">
        {visible.map((p) => {
          const qty = cart[p.article] || 0
          return (
            <div className="sh-card" key={p.article}>
              <div className="sh-ph" onClick={() => setView({ name: 'product', article: p.article })}>
                {p.photo ? <img src={p.photo} alt="" /> : <i className="ti ti-photo ph-ic" />}
              </div>
              <div className="sh-cbody">
                <div className="sh-cname" onClick={() => setView({ name: 'product', article: p.article })}>{p.name}</div>
                {p.volume && <div className="sh-cvol">{p.volume}</div>}
                <div className="sh-cprice">{rub(priceOf(p))}{mode === 'retail' && p.priceOpt > 0 && p.priceOpt < p.priceRetail && <span className="sh-cold">опт {rub(p.priceOpt)}</span>}</div>
                <div className={'sh-stock ' + (p.stock > 0 ? 'in' : 'out')}>{p.stock > 0 ? 'в наличии' : 'под заказ'}</div>
                {qty > 0 ? (
                  <div className="sh-qty">
                    <button onClick={() => setQty(p.article, qty - 1)}>−</button>
                    <span>{qty}</span>
                    <button onClick={() => setQty(p.article, qty + 1)}>+</button>
                  </div>
                ) : <button className="sh-add" onClick={() => setQty(p.article, 1)}>В корзину</button>}
              </div>
            </div>
          )
        })}
        {!visible.length && <div className="sh-empty" style={{ gridColumn: '1 / -1' }}>Ничего не найдено</div>}
      </div>

      {cartCount > 0 && (
        <div className="sh-bar"><div className="sh-bar-inner">
          <button className="sh-cta" onClick={() => setView({ name: 'cart' })}><i className="ti ti-shopping-cart" /> Корзина · {cartCount} · {rub(goods)}</button>
        </div></div>
      )}
    </>
  )
}
