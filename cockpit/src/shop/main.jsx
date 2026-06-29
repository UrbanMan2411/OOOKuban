import React from 'react'
import ReactDOM from 'react-dom/client'
import Shop from './Shop'
import './shop.css'

// Wire Telegram WebApp: expand to full height, signal ready, and map the
// active theme palette onto our CSS vars so the store matches the user's client.
const tg = window.Telegram?.WebApp
if (tg) {
  try {
    tg.ready(); tg.expand()
    const p = tg.themeParams || {}
    const root = document.documentElement.style
    const set = (k, v) => v && root.setProperty(k, v)
    set('--tg-bg', p.bg_color); set('--tg-secondary-bg', p.secondary_bg_color)
    set('--tg-text', p.text_color); set('--tg-hint', p.hint_color)
    set('--tg-link', p.link_color); set('--tg-button', p.button_color)
    set('--tg-button-text', p.button_text_color)
    if (tg.colorScheme === 'dark') document.documentElement.classList.add('tg-dark')
  } catch { /* not in Telegram → fallback light theme */ }
}

ReactDOM.createRoot(document.getElementById('shop')).render(
  <React.StrictMode><Shop /></React.StrictMode>,
)
