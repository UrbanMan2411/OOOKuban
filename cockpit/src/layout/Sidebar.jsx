import React from 'react'
import { NavLink } from 'react-router-dom'

const NAV = [
  {
    title: 'Анализ',
    items: [
      { to: '/analytics', label: 'Рынок · скрипты · тренды' },
      { to: '/analytics/ozon', label: 'Озон · топ SKU' },
      { to: '/analytics/wb', label: 'Wildberries · топ SKU' },
    ],
  },
  {
    title: 'Генераторы',
    items: [
      { to: '/generators/matreshka', label: 'Матрёшка · прайс PDF' },
      { to: '/generators/greenpanda', label: 'GreenPanda · прайс PDF' },
    ],
  },
  {
    title: 'Магазин',
    items: [{ to: '/store', label: 'Telegram-витрина' }],
  },
  {
    title: 'План',
    items: [{ to: '/plan', label: 'Канбан' }],
  },
  {
    title: 'Файлы',
    items: [{ to: '/downloads', label: 'Загрузки' }],
  },
]

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="name">КубаньБытХим · Cockpit</span>
        <span className="sub">Аналитика · генераторы · план</span>
      </div>
      {NAV.map((group) => (
        <div key={group.title} className="nav-group">
          <div className="nav-group-title">{group.title}</div>
          {group.items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end
              className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
            >
              <span className="dot" />
              {it.label}
            </NavLink>
          ))}
        </div>
      ))}
    </aside>
  )
}
