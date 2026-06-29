import React, { useEffect, useState } from 'react'
import { setSelfHost } from '../lib/platform'

// Gates the whole app behind a shared password (when COCKPIT_PASSWORD is set
// server-side). On local dev (no /api) the check fails open so it never blocks.
export default function AuthGate({ children }) {
  const [state, setState] = useState('checking') // checking | ok | locked
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const check = async () => {
    try {
      const r = await fetch('/api/auth')
      const j = await r.json() // throws on local dev (index.html) → caught below
      setSelfHost(j.selfHost)
      setState(!j.required || j.authed ? 'ok' : 'locked')
    } catch { setState('ok') }
  }
  useEffect(() => { check() }, [])

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    try {
      const r = await fetch('/api/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }),
      })
      const j = await r.json().catch(() => ({}))
      if (j.ok) { setState('ok'); setPw('') } else setErr(j.message || 'Неверный пароль')
    } catch { setErr('Сеть недоступна') }
    setBusy(false)
  }

  if (state === 'checking') return <div className="auth-wrap"><div className="auth-card">Загрузка…</div></div>
  if (state === 'locked') {
    return (
      <div className="auth-wrap">
        <form className="auth-card" onSubmit={submit}>
          <div className="auth-title">КубаньБытХим · Cockpit</div>
          <div className="auth-sub">Введите пароль для входа</div>
          <input className="auth-input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Пароль" autoFocus />
          {err && <div className="auth-err">{err}</div>}
          <button className="btn" type="submit" disabled={busy || !pw}>{busy ? 'Проверяю…' : 'Войти'}</button>
        </form>
      </div>
    )
  }
  return children
}
