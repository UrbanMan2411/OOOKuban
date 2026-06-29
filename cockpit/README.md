# КубаньБытХим · Cockpit

Единый веб-дашборд для брендов **MATRЁSHKA** и **GreenPanda** (ООО «КубаньБытХим»):
аналитика рынка и маркетплейсов, генераторы прайс-листов и канбан-план.

🔗 Прод: https://cockpit-snowy-six.vercel.app

## Разделы

### Анализ
- **Рынок · скрипты · тренды** — дашборд-шаблон (xlsx), скрипты выгрузки (WB-парсер, MPSTATS-конвертер) и тренд-бриф 2025–2026.
- **Озон · топ SKU** — топ товаров из кабинета Ozon Seller по выручке, заказам, показам и конверсии. Данные через серверless-прокси `/api/ozon/top-sku` (ключ в env, не в браузере).
- **Wildberries · топ SKU** — воронка продаж по карточкам (показы → корзина → заказы → выкупы) из Analytics API WB. Прокси `/api/wb/top-sku`.

### Генераторы
- **Матрёшка / GreenPanda · прайс PDF** — загрузка `.xlsx` эталонного прайса → фирменный PDF. Фото берутся из файла, белый фон убирается автоматически, цены округляются вверх до рубля.

### План
- **Канбан** — доска задач (drag-and-drop), хранится локально в браузере. Включает 30-дневный план продвижения на маркетплейсах.

## Стек
React 18 · Vite 5 · React Router · @hello-pangea/dnd · pdf-lib · xlsx (SheetJS) · jszip.
Serverless-функции — Vercel Functions (`/api/**`).

## Переменные окружения (Vercel → Settings → Environment Variables)
Секреты живут **только** в env Vercel, в код и git не попадают. См. `.env.example`.

| Переменная | Назначение |
|---|---|
| `OZON_CLIENT_ID` | Client-Id кабинета Ozon Seller |
| `OZON_API_KEY` | Api-Key кабинета Ozon Seller (read) |
| `WB_TOKEN` | JWT-токен WB с доступом к категории «Аналитика» (read) |

После изменения переменных нужен **передеплой**.

## Разработка
```bash
npm install
npm run dev        # Vite dev-сервер (без serverless-функций)
vercel dev         # с serverless-функциями /api/** (нужны env)
npm run build      # прод-сборка в dist/
```

## Деплой
```bash
vercel --prod
```
SPA-роутинг и исключение `/api` настроены в `vercel.json`.
