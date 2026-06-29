// Tiny localStorage-backed store for the kanban board.
// Single-user, single-device, no backend. State shape:
//   { columns: [{ id, title }], cards: { [colId]: Card[] } }
// Card: { id, title, desc, tag, assignee, due, createdAt, updatedAt }

const KEY = 'cockpit.kanban.v1'

export const COLUMNS = [
  { id: 'backlog',  title: 'Бэклог' },
  { id: 'doing',    title: 'В работе' },
  { id: 'review',   title: 'На проверке' },
  { id: 'done',     title: 'Готово' },
]

export const TAGS = [
  { id: 'analysis',    label: 'Анализ' },
  { id: 'marketplace', label: 'Маркетплейс' },
  { id: 'channels',    label: 'Каналы' },
  { id: 'matreshka',   label: 'Матрёшка' },
  { id: 'greenpanda',  label: 'GreenPanda' },
  { id: 'other',       label: 'Прочее' },
]

// One-time task packs imported on load (idempotent — each pack runs once,
// flagged inside the saved state). Lets us push a predefined backlog into an
// already-populated board without wiping the user's own cards.
const IMPORT_PACKS = {
  marketplacePlan: {
    column: 'backlog',
    tag: 'marketplace',
    cards: [
      ['Н1 · База SKU', 'День 1–2. Цена, себестоимость, маржа, остатки, продажи, выручка, реклама, рейтинг, отзывы → единая таблица товаров.'],
      ['Н1 · Аудит карточек 1–5', 'День 3. Оценить каждую карточку: главное фото, инфографика, SEO, описание, отзывы, видео, цена, категории.'],
      ['Н1 · Карта конкурентов', 'День 4–5. 10–20 конкурентов по категориям: антижир, универсал, полы, стекла, мыло, сантехника, 5L.'],
      ['Н1 · Документ аудита', 'День 6–7. Список проблем, быстрые улучшения и приоритеты.'],
      ['Н2 · Новая структура карточки', '8 слайдов: главный экран · назначение · выгода 5L · концентрат · до/после · удобство · бренд · линейка. Масштабировать на все SKU.'],
      ['Н3 · A/B-тест главного фото', 'Варианты обложки: товар крупно / +5L / +применение / +матрёшка.'],
      ['Н3 · Обновить SEO', 'Заголовки, описания, характеристики, поисковые фразы под спрос.'],
      ['Н3 · Сегментация SKU', 'A — основные для продвижения, B — тестовые, C — слабые до доработки.'],
      ['Н3 · Запуск рекламы', 'Только на товары с остатком, маржей и готовой карточкой.'],
      ['Н3 · Мониторинг 2–3 дня', 'Показы, CTR, корзины, заказы, ДРР, позиции, остатки.'],
      ['Н4 · Еженедельный отчёт', 'Что изменили / что выросло / что просело / что делаем дальше.'],
      ['Н4 · Центр управления (Sheets)', 'SKU, юнит-экономика, реклама, SEO, конкуренты, гипотезы, контент-план.'],
      ['Н4 · Матрица решений', 'Когда менять фото / цену / рекламу / SEO / акцию / работу с отзывами.'],
      ['Н4 · Стратегия на 2–3 мес.', 'Какие SKU масштабировать, какие карточки дорабатывать, куда направлять бюджет.'],
      ['KPI-контроль', 'Показы, CTR, конверсия в заказ, ДРР, маржа, позиции по ключам, остатки.'],
      ['Автоматизация (Claude Code)', 'Склейка CSV/Excel WB+Ozon, расчёт ДРР/маржи, генератор недельного отчёта, мини-дашборд.'],
    ],
  },
  salesChannels: {
    column: 'backlog',
    tag: 'channels',
    cards: [
      ['Настройка и запуск магазина в Telegram', 'Подключить Telegram-магазин (бот/витрина): каталог, карточки, корзина, оплата, доставка, запуск.'],
      ['Структура мини-приложения ВКонтакте', 'VK Mini App: разделы, каталог, карточки товаров, корзина, навигация, интеграция оплаты.'],
      ['Создание КП', 'Коммерческое предложение для байеров/опта: ассортимент, цены, условия, преимущества, контакты.'],
      ['ИИ-агент рассылки по соцсетям', 'Автоматизация постов и рассылок по соцсетям: контент-план, расписание, генерация текстов/визуала.'],
    ],
  },
}

const nowIso = () => new Date().toISOString()
const newId = () => 'c_' + Math.random().toString(36).slice(2, 10)

function seed() {
  const t = nowIso()
  return {
    columns: COLUMNS,
    cards: {
      backlog: [
        { id: newId(), title: 'Получить read-only API-ключи WB и Ozon', desc: 'Сгенерировать токены для разделов Статистика/Аналитика/Контент. Отдать в скрипт.', tag: 'analysis', assignee: '', due: '', createdAt: t, updatedAt: t },
        { id: newId(), title: 'Прогнать выгрузку MPSTATS через конвертер', desc: 'Категория Стирка / Посуда / Чистящие — выгрузить и вставить в дашборд.', tag: 'analysis', assignee: '', due: '', createdAt: t, updatedAt: t },
      ],
      doing: [
        { id: newId(), title: 'Развернуть Cockpit-дашборд', desc: 'Единый интерфейс: Анализ · Генераторы · План.', tag: 'other', assignee: '', due: '', createdAt: t, updatedAt: t },
      ],
      review: [],
      done: [
        { id: newId(), title: 'Округление цен вверх (оба генератора)', desc: 'Math.ceil + формат без копеек, в превью и в PDF.', tag: 'matreshka', assignee: '', due: '', createdAt: t, updatedAt: t },
        { id: newId(), title: 'Убрать белый фон у фото в PDF', desc: 'Flood-fill от границ, прозрачные PNG.', tag: 'matreshka', assignee: '', due: '', createdAt: t, updatedAt: t },
      ],
    },
  }
}

export function applyImports(state) {
  state.imported = state.imported || {}
  let changed = false
  for (const [packId, pack] of Object.entries(IMPORT_PACKS)) {
    if (state.imported[packId]) continue
    const t = nowIso()
    const cards = pack.cards.map(([title, desc]) => ({
      id: newId(), title, desc: desc || '', tag: pack.tag || 'other',
      assignee: '', due: '', createdAt: t, updatedAt: t,
    }))
    const col = pack.column
    state.cards[col] = [...(state.cards[col] || []), ...cards]
    state.imported[packId] = true
    changed = true
  }
  if (changed) saveState(state)
  return state
}

export function loadState() {
  let s
  try {
    const raw = localStorage.getItem(KEY)
    s = raw ? JSON.parse(raw) : seed()
    if (!s || !s.cards || !s.columns) s = seed()
  } catch {
    s = seed()
  }
  // Backfill any missing columns (in case of schema growth)
  for (const col of COLUMNS) if (!s.cards[col.id]) s.cards[col.id] = []
  return applyImports(s)
}

export function saveState(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch {}
}

// ── shared cloud board (Blob via /api/plan/board) ──
export async function loadCloud() {
  try {
    const r = await fetch('/api/plan/board')
    if (!r.ok) return null
    const j = await r.json()
    return j && j.board && j.board.cards ? j.board : null
  } catch { return null }
}

export async function saveCloud(state) {
  try {
    await fetch('/api/plan/board', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ board: state }),
    })
  } catch { /* offline → localStorage keeps the copy */ }
}

export function createCard(state, colId, fields) {
  const t = nowIso()
  const card = {
    id: newId(),
    title: (fields.title || '').trim() || 'Без названия',
    desc: fields.desc || '',
    tag: fields.tag || 'other',
    assignee: fields.assignee || '',
    due: fields.due || '',
    createdAt: t, updatedAt: t,
  }
  const next = { ...state, cards: { ...state.cards, [colId]: [...state.cards[colId], card] } }
  saveState(next); return next
}

export function updateCard(state, cardId, fields) {
  const next = { ...state, cards: { ...state.cards } }
  for (const col of state.columns) {
    const idx = next.cards[col.id].findIndex((c) => c.id === cardId)
    if (idx >= 0) {
      const card = { ...next.cards[col.id][idx], ...fields, updatedAt: nowIso() }
      next.cards[col.id] = [...next.cards[col.id]]
      next.cards[col.id][idx] = card
      break
    }
  }
  saveState(next); return next
}

export function deleteCard(state, cardId) {
  const next = { ...state, cards: { ...state.cards } }
  for (const col of state.columns) {
    next.cards[col.id] = next.cards[col.id].filter((c) => c.id !== cardId)
  }
  saveState(next); return next
}

export function moveCard(state, srcCol, srcIdx, dstCol, dstIdx) {
  const next = { ...state, cards: { ...state.cards } }
  const src = [...next.cards[srcCol]]
  const [moved] = src.splice(srcIdx, 1)
  if (!moved) return state
  next.cards[srcCol] = src
  const dst = srcCol === dstCol ? src : [...next.cards[dstCol]]
  dst.splice(dstIdx, 0, moved)
  next.cards[dstCol] = dst
  saveState(next); return next
}
