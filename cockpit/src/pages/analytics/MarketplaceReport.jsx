import React, { useCallback, useEffect, useMemo, useState } from 'react'

// Shared marketplace top-SKU report. Ozon and WB pass a `config` describing the
// endpoint, texts, stat cards, table columns and CSV — everything else (state,
// loading/error, period chips, bars, table shell) is identical.
export const rub = (n) => Math.round(n).toLocaleString('ru-RU') + ' ₽'
export const int = (n) => Math.round(n).toLocaleString('ru-RU')
export const pct = (n) => (+n || 0).toFixed(1).replace('.', ',') + '%' // value already in percent

// Trim keyword-stuffed marketplace titles to a short, clear label: drop the
// part after the first comma, then cap at a word boundary.
export const shorten = (s, max = 42) => {
  if (!s) return s
  let t = String(s).split(',')[0].trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const sp = cut.lastIndexOf(' ')
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).trim() + '…'
}

const iso = (d) => d.toISOString().slice(0, 10)
const rangeFor = (days) => {
  const to = new Date(), from = new Date(to.getTime() - days * 86400000)
  return { from: iso(from), to: iso(to) }
}
const PERIODS = [{ id: 7, label: '7 дней' }, { id: 30, label: '30 дней' }, { id: 90, label: '90 дней' }]

export default function MarketplaceReport({ config: C }) {
  const [days, setDays] = useState(30)
  const [state, setState] = useState({ status: 'loading', rows: [], totals: null, error: '' })

  const load = useCallback(async (d) => {
    setState((s) => ({ ...s, status: 'loading', error: '' }))
    const { from, to } = rangeFor(d)
    try {
      const r = await fetch(`${C.endpoint}?from=${from}&to=${to}&limit=50`)
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        const msg = j.error === 'not_configured' ? j.message
          : `${C.apiName} ответил ${j.status || r.status}: ${j.message || 'ошибка запроса'}`
        setState({ status: 'error', rows: [], totals: null, error: msg }); return
      }
      setState({ status: 'ready', rows: j.rows || [], totals: j.totals || null, error: '', from, to })
    } catch (e) {
      setState({ status: 'error', rows: [], totals: null, error: 'Сеть недоступна: ' + (e.message || e) })
    }
  }, [C])

  useEffect(() => { load(days) }, [days, load])

  const maxRev = useMemo(() => state.rows.reduce((m, r) => Math.max(m, r.revenue), 0) || 1, [state.rows])

  const exportCsv = useCallback(() => {
    const { head, rows } = C.csv(state.rows, state.totals)
    const body = ['﻿' + [head.join(','), ...rows.map((c) => c.join(','))].join('\n')]
    const url = URL.createObjectURL(new Blob(body, { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = `${C.csvName}-${state.from || ''}_${state.to || ''}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 3000)
  }, [C, state.rows, state.totals, state.from, state.to])

  const top10 = state.rows.slice(0, 10)
  const stats = state.totals ? C.stats(state.totals) : []
  const cols = C.columns

  return (
    <div className={C.scope || undefined}>
      <h1 className="page-title">{C.title}</h1>
      <p className="page-sub">{C.sub}</p>

      <div className="oz-toolbar">
        <div className="oz-chips">
          {PERIODS.map((p) => (
            <button key={p.id} type="button" className={'oz-chip' + (days === p.id ? ' on' : '')} onClick={() => setDays(p.id)}>{p.label}</button>
          ))}
        </div>
        <div className="oz-actions">
          <button className="btn ghost" type="button" onClick={() => load(days)} disabled={state.status === 'loading'}>↻ Обновить</button>
          <button className="btn" type="button" onClick={exportCsv} disabled={state.status !== 'ready' || !state.rows.length}>↓ Скачать CSV</button>
        </div>
      </div>

      {state.status === 'loading' && <div className="card oz-msg"><p>{C.loadingText}</p></div>}
      {state.status === 'error' && (
        <div className="card oz-msg oz-err">
          <strong>Не удалось получить данные</strong>
          <p>{state.error}</p>
          <p className="oz-hint">{C.hint}</p>
        </div>
      )}

      {state.status === 'ready' && state.totals && (
        <>
          <div className="oz-stats">
            {stats.map((s, i) => (
              <div className="oz-stat" key={i}>
                <span className="oz-stat-label">{s.label}</span>
                <span className="oz-stat-val">{s.value}</span>
              </div>
            ))}
          </div>

          {top10.length > 0 && (
            <div className="card">
              <h3 className="oz-h3">Топ-10 по выручке</h3>
              <div className="oz-bars">
                {top10.map((r, i) => (
                  <div className="oz-bar-row" key={C.rowKey(r, i)}>
                    <span className="oz-bar-name" title={C.bar.title(r)}>{i + 1}. {C.bar.name(r)}</span>
                    <div className="oz-bar-track"><div className="oz-bar-fill" style={{ width: `${Math.max(2, (r.revenue / maxRev) * 100)}%` }} /></div>
                    <span className="oz-bar-val">{rub(r.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card oz-tablewrap">
            <table className="oz-table">
              <thead><tr>{cols.map((c, i) => <th key={i} className={c.thCls || undefined}>{c.header}</th>)}</tr></thead>
              <tbody>
                {state.rows.map((r, i) => (
                  <tr key={C.rowKey(r, i)}>
                    {cols.map((c, ci) => <td key={ci} className={c.tdCls || undefined}>{c.render(r, i, state.totals)}</td>)}
                  </tr>
                ))}
                {!state.rows.length && <tr><td colSpan={cols.length} className="oz-empty">За выбранный период данных нет.</td></tr>}
              </tbody>
            </table>
          </div>
          {C.note && <p className="oz-note">{C.note}</p>}
        </>
      )}
    </div>
  )
}
