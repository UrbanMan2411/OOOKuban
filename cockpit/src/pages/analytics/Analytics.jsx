import React, { useState } from 'react'

function SkuReport() {
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const run = async () => {
    setStatus('loading'); setError('')
    try {
      const r = await fetch('/api/reports/sku', { method: 'POST' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setError(j.message || 'Ошибка сбора отчёта'); setStatus('error'); return }
      setResult(j); setStatus('done')
    } catch (e) { setError('Сеть недоступна: ' + (e.message || e)); setStatus('error') }
  }
  return (
    <div className="card">
      <h3>База SKU + ABC · WB + Ozon</h3>
      <p>
        Свежая таблица по всем товарам за 30 дней: выручка, заказы, показы, конверсия, выкуп, остатки, рейтинг
        + <b>ABC-сегментация</b> (A — флагманы, B — средние, C — слабые; по выручке, Парето 80/15/5).
        Файл сохраняется в <b>Загрузки → Отчёты</b>.
      </p>
      <button className="btn" onClick={run} disabled={status === 'loading'}>
        {status === 'loading' ? 'Собираю данные…' : '📊 Собрать базу SKU'}
      </button>
      {status === 'done' && result && (
        <p style={{ marginTop: 12, fontSize: 13.5 }}>
          ✓ Готово: <b>{result.total}</b> SKU (WB {result.wb} · Ozon {result.oz}), выручка{' '}
          <b>{(result.revenue || 0).toLocaleString('ru-RU')} ₽</b>.
          {result.abc && <> ABC: <b>A {result.abc.A}</b> · B {result.abc.B} · C {result.abc.C}.</>}{' '}
          <a href={result.url} download target="_blank" rel="noreferrer">Скачать xlsx</a>
          {(result.wbErr || result.ozErr) && (
            <span style={{ color: '#8a6914' }}><br />⚠ {[result.wbErr && 'WB: ' + result.wbErr, result.ozErr && 'Ozon: ' + result.ozErr].filter(Boolean).join('; ')}</span>
          )}
        </p>
      )}
      {status === 'error' && <p style={{ color: '#c9302c', marginTop: 12, fontSize: 13.5 }}>{error}</p>}
    </div>
  )
}

function WeeklyReport() {
  const [status, setStatus] = useState('idle')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const run = async () => {
    setStatus('loading'); setError('')
    try {
      const r = await fetch('/api/reports/weekly', { method: 'POST' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setError(j.message || 'Ошибка сбора отчёта'); setStatus('error'); return }
      setResult(j); setStatus('done')
    } catch (e) { setError('Сеть недоступна: ' + (e.message || e)); setStatus('error') }
  }
  return (
    <div className="card">
      <h3>Отчёт за неделю · динамика</h3>
      <p>
        Что выросло и что просело: выручка по SKU за последние 7 дней против предыдущих 7.
        Лист «Движение» отсортирован от роста к падению. Файл — в <b>Загрузки → Отчёты</b>.
      </p>
      <button className="btn" onClick={run} disabled={status === 'loading'}>
        {status === 'loading' ? 'Считаю динамику…' : '📈 Отчёт за неделю'}
      </button>
      {status === 'done' && result && (
        <p style={{ marginTop: 12, fontSize: 13.5 }}>
          ✓ Выручка <b>{(result.curAll || 0).toLocaleString('ru-RU')} ₽</b>{' '}
          <b style={{ color: (result.deltaPct >= 0 ? 'var(--green-7)' : '#c9302c') }}>
            {result.deltaPct >= 0 ? '▲ +' : '▼ '}{result.deltaPct}%
          </b>{' '}к прошлой неделе. Выросло {result.up} · просело {result.down}.{' '}
          <a href={result.url} download target="_blank" rel="noreferrer">Скачать xlsx</a>
          {(result.topUp?.length > 0) && <span style={{ color: 'var(--muted)' }}><br />↑ {result.topUp.join('; ')}</span>}
          {(result.topDown?.length > 0) && <span style={{ color: 'var(--muted)' }}><br />↓ {result.topDown.join('; ')}</span>}
        </p>
      )}
      {status === 'error' && <p style={{ color: '#c9302c', marginTop: 12, fontSize: 13.5 }}>{error}</p>}
    </div>
  )
}

const MATRIX = [
  ['Много показов, мало кликов (низкий CTR)', 'Менять главное фото и первый оффер: товар крупнее, выгода 5L, «концентрат», бейдж бренда. A/B-тест обложки.'],
  ['Много кликов, мало заказов (низкая конверсия)', 'Проверить цену vs конкуренты, отзывы и рейтинг, описание/характеристики, фото «до/после», условия доставки.'],
  ['Реклама дорогая (высокий ДРР)', 'Снизить ставки, почистить минус-запросы, отключить слабые SKU; рекламу — только на товары с маржой и остатком.'],
  ['Хорошая конверсия, но мало трафика', 'Усилить рекламу и расширить SEO (заголовок, характеристики, ключи), добавить в акции.'],
  ['Продажи есть, но низкая маржа', 'Пересчитать цену/скидки, поднять до целевой ₽/л, ограничить рекламные лимиты, проверить логистику.'],
  ['Хороший товар, но мало отзывов', 'Запустить работу с отзывами (баллы за отзыв, вкладыши), усилить доверительные слайды карточки.'],
  ['Товар почти не ищут', 'Сменить категорию/предмет, переписать название и SEO под спрос (Wordstat), пересмотреть позиционирование.'],
  ['Заканчивается остаток у топ-SKU (класс A)', 'Срочно пополнить, НЕ лить рекламу в кончающийся товар; перераспределить бюджет на A с остатком.'],
  ['SKU в классе C (слабые, длинный хвост)', 'Доработать карточку/цену один раз — если не растёт, вывести из ассортимента и не тратить рекламу.'],
]

const BRIEF = [
  ['Рост категории на МП', 'WB: бытовая химия — заказы за год выросли ~2× (сент.24 ≈ 5.0 млн → сент.25 ≈ 10.7 млн). SKU 46→138 тыс., продавцов 4.6→10.3 тыс. Рынок растёт, конкуренция тоже.'],
  ['Самые быстрорастущие подкатегории', 'Освежители/нейтрализаторы запахов +126%, чистящие +86%, средства для стирки +62%. Стирка — крупнейшая категория, далее посуда, кухня/сантехника.'],
  ['Онлайн обгоняет офлайн', 'NielsenIQ: онлайн-продажи средств для стирки +96.8% за год, средств для уборки +65.8%. Канал маркетплейсов — приоритет.'],
  ['Эко и чистый состав', 'Спрос на биоразлагаемую, гипоаллергенную, без фосфатов. Локальные эко-бренды теснят международный премиум — прямо ваша поляна.'],
  ['Импортозамещение', 'Самообеспеченность РФ ~96%. Контрактное производство и СТМ растут — возможность для B2B и частных марок.'],
  ['Запахи · велнес', 'Лаванда, эвкалипт — «уборка как забота о себе». Clorox/Lysol запускают лавандовые линейки.'],
  ['Запахи · морские и природные', 'Свежесть океана, травяные эфирные масла — заходят эко-аудитории.'],
  ['Запахи · гурман и премиум', 'Ваниль, карамель, флёрдоранж, мускус — апселл, премиальные парфюмерные аккорды.'],
  ['Запахи · стойкость', 'Микрокапсулы / инкапсуляция аромата ~16% CAGR. Заявка «долго пахнет» хорошо продаёт.'],
  ['«Без запаха»', 'Стабильный сегмент: аллергики, детское, чувствительная кожа. Держать отдельным SKU.'],
  ['Регуляторика 2025+', 'Поэтапная обязательная цифровая маркировка бытовой химии и косметики — учесть в себестоимости и логистике.'],
]

const SOURCES = [
  ['ChemiCos — Рынок бытовой химии 2025–2026', 'https://chemicos.ru/ru/press/news/2025-2026'],
  ['vc.ru — Российский рынок бытовой химии: тренды и рост до 2030', 'https://vc.ru/marketing/2283828-rossijskij-rynok-bytovoj-himii-novye-trendy-i-rost-do-2030-goda'],
  ['РБК Компании — FMCG на маркетплейсах: бытовая химия', 'https://companies.rbc.ru/news/ameV4chdTI/fmcg-na-marketplejsah-kto-rastet-byistree-vseh-v-byitovoj-himii-i-uhode/'],
  ['GuruSeller — Wildberries и Ozon в 2025', 'https://guruseller.ru/wildberries-i-ozon-v-2025-godu-kuda-dvizhutsya-krupneishie-marketpleisy-rossii/'],
  ['Happi — Clean Scents Lead in Home Care', 'https://www.happi.com/clean-scents-lead-in-home-care/'],
  ['Phoenix FF — 5 Scent Trends Transforming Home Care', 'https://phoenixff.com/news/5-scent-trends-transforming-home-care/'],
]

const DOWNLOADS = [
  {
    title: 'Дашборд-шаблон',
    desc: '6 листов с формулами: цены конкурентов (₽/литр считается сам), спрос по ключам Wordstat, трекер запахов, сводка-разрывы, тренд-бриф.',
    meta: 'xlsx · 32 КБ',
    href: '/downloads/matreshka-market-analytics.xlsx',
    btn: 'Скачать xlsx',
  },
  {
    title: 'WB-скрипт (публичный поиск)',
    desc: 'Тянет цены, рейтинги, запахи по категориям WB через открытый JSON-API. Зависимостей нет — только стандартный Python. Запускать с домашнего IP без VPN.',
    meta: 'wb_scraper.py · Python 3.x',
    href: '/downloads/wb_scraper.py',
    btn: 'Скачать .py',
  },
  {
    title: 'MPSTATS-конвертер',
    desc: 'Превращает выгрузку из MPSTATS (.xlsx/.csv) в формат листа «Цены конкурентов» — сам разбирает объём/запах/формат из названий.',
    meta: 'mpstats_to_dashboard.py · Python 3.x',
    href: '/downloads/mpstats_to_dashboard.py',
    btn: 'Скачать .py',
  },
]

export default function Analytics() {
  return (
    <>
      <h1 className="page-title">Анализ рынка</h1>
      <p className="page-sub">Дашборд-шаблон, скрипты выгрузки и тренд-бриф 2025–2026.</p>

      <h2 style={{ fontSize: 16, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '.08em', margin: '8px 0 12px' }}>
        Сводные отчёты
      </h2>
      <div className="cards-grid">
        <SkuReport />
        <WeeklyReport />
      </div>

      <h2 style={{ fontSize: 16, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '.08em', margin: '36px 0 12px' }}>
        Матрица решений
      </h2>
      <div className="card">
        <dl className="brief">
          {MATRIX.map(([s, d]) => (
            <React.Fragment key={s}>
              <dt>{s}</dt>
              <dd>{d}</dd>
            </React.Fragment>
          ))}
        </dl>
      </div>

      <h2 style={{ fontSize: 16, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '.08em', margin: '8px 0 12px' }}>
        Скрипты и шаблоны
      </h2>
      <div className="cards-grid">
        {DOWNLOADS.map((d) => (
          <div key={d.title} className="card">
            <h3>{d.title}</h3>
            <div className="meta">{d.meta}</div>
            <p>{d.desc}</p>
            <a className="btn" href={d.href} download>↓ {d.btn}</a>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 16, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '.08em', margin: '36px 0 12px' }}>
        Тренды 2025–2026
      </h2>
      <div className="card">
        <dl className="brief">
          {BRIEF.map(([t, d]) => (
            <React.Fragment key={t}>
              <dt>{t}</dt>
              <dd>{d}</dd>
            </React.Fragment>
          ))}
        </dl>
        <div className="sources">
          <strong style={{ color: 'var(--bordo)', fontSize: 13 }}>Источники</strong>
          <ul>
            {SOURCES.map(([t, u]) => (
              <li key={u}>
                <a href={u} target="_blank" rel="noreferrer">{t}</a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}
