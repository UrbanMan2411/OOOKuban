# ОООКубань — GreenPanda / Matrёshka

Монорепозиторий бизнеса **КубаньБытХим**: эко-бытовая химия под брендами **GreenPanda** (B2B, маркетплейс-байеры) и **Matrёshka** (B2C/розница на WB, Ozon, МВидео). Здесь лендинги, интернет-магазин, Telegram-боты, прайс-тулзы и скрипты деплоя — раньше это были 5 отдельных репозиториев, теперь всё консолидировано сюда.

> Контекст для Claude: этот файл — карта проекта. Секретов в репо нет (см. «Секреты»). Прод живёт на своём VPS, не на Vercel.

## Структура

| Папка | Что это |
|---|---|
| `index.html`, `assets/` | Корневой лендинг (статика) + рендеры/ассеты |
| `gp-variants/` | Варианты лендинга (`fullbleed` — боевой, с видео в шапке; `matreshka-landing` — лендинг бренда Matrёshka; плюс eco/premium/strict/… черновики) |
| `presentations/` | Презентации (`horeca`, `video-horeca`) |
| `deck/` | Отдельный слайд-деки (Vite) |
| `cockpit/` | **Главное приложение**: магазин (витрина `/shop` + Telegram Mini App) и админка (`/store`). Node/Express + Vite. См. ниже |
| `price-tool/`, `matreshka-price-tool/` | Веб-тулзы для прайсов/каталога (Vite) |
| `market-analytics/` | Аналитика по рынку (xlsx) |
| `tgbot/` | Личный Telegram-бот (Python, заметки/встречи). НЕ магазинный бот |
| `deploy/` | Скрипты и юниты для self-host (provision, deploy, nginx, systemd). Раннбук — `deploy/HOSTING.md` |
| `scripts/` | Разные вспомогательные скрипты |

## cockpit (магазин + админка)

- **Стек:** React + Vite (мульти-энтри: `index.html` — дашборд/админка, `shop.html` — витрина), бэкенд — Express (`server/index.js`), хендлеры в `cockpit/api/**`.
- **Хранилище:** абстракция `cockpit/api/_storage.js` — на проде файлы на диске (`STORAGE_DIR`), на Vercel был Blob. Self-host активен, когда задан `STORAGE_DIR` и нет `BLOB_READ_WRITE_TOKEN`.
- **API-разделы:** `api/shop` (каталог, заказы, бот-вебхук), `api/wb` + `api/ozon` (интеграции маркетплейсов), `api/plan`, `api/reports`, `api/downloads`, `api/auth`.
- **Каталог:** гибрид WB+Ozon (дедуп по артикулу), цены из прайсов (xlsx), фото из карточек. Розница = средняя WB, опт = прайс.
- **Запуск локально:**
  ```bash
  cd cockpit && npm install && npm run build
  npm start            # node --env-file=.env server/index.js  (нужен .env)
  npm run dev          # vite dev для фронта
  ```
- Подробнее: `cockpit/README.md`, `cockpit/SHOP.md`.

## Боты

- **Магазинный бот** `@kubanbithimbot` — Telegram Mini App «Магазин» → `/shop`. Вебхук → `cockpit/api/shop/bot` (проверяется `TG_WEBHOOK_SECRET`). Заказы валидируют initData. Уведомления о заказах — в группу.
- **Hermes AI-агент** `@kubanaibot` («Кубань-ассистент») — на сервере (systemd `hermes-gateway`), отвечает в группе по @упоминанию, знания в `~/.hermes/memories/`. Конфиг не в этом репо.
- **tgbot/** — отдельный личный бот (Python), не задеплоен.

## Прод / деплой

- **VPS:** `193.124.59.187` (Ubuntu), доступ по SSH-ключу. Домен **greenpanda-eco.ru** (TLS Let's Encrypt, автопродление).
  - `https://greenpanda-eco.ru` — лендинг (`gp-variants/fullbleed`), статика на apex; разделы `/deck /price /matreshka /variants /presentations`.
  - `https://app.greenpanda-eco.ru` — cockpit (Node systemd `cockpit`, порт 3000, файловое хранилище в `/var/lib/greenpanda/cockpit`).
- **nginx:** apex — статика; `app.` — прокси на :3000. Деплой-цель и юниты — в `deploy/`.
- **Деплой cockpit:** `cd cockpit && npm run build && rsync … /opt/greenpanda/cockpit && systemctl restart cockpit`.

## Маркетплейс-интеграции

- **Wildberries:** Content API (`content-api.wildberries.ru`) — карточки, фото (CDN `*.wbbasket.ru`), описания. Токен `WB_TOKEN` (JWT).
- **Ozon:** Seller API (`api-seller.ozon.ru`) — `OZON_CLIENT_ID` + `OZON_API_KEY`. Товары/атрибуты/фото/описания.
- **МВидео:** загрузка через xlsx-шаблоны («Шаблон для загрузки товаров»). Заполняются из данных Озона/WB (бренд `MATRЁSHKA`, НДС 22%, мастер-кейс/паллета, EAN-13 коробов).

## Секреты (НЕ в репозитории)

Исключены через `.gitignore`: `*.env` (кроме `*.env.example`), `*.local`, `node_modules/`, `.venv/`.
Боевые значения живут на сервере в `/opt/greenpanda/cockpit/.env`:
`COCKPIT_PASSWORD`, `WB_TOKEN`, `OZON_CLIENT_ID`, `OZON_API_KEY`, `TG_BOT_TOKEN`, `TG_WEBHOOK_SECRET`, `STORAGE_DIR`, `PUBLIC_BASE`.
Образцы переменных — `deploy/cockpit.env.example`, `deploy/tgbot.env.example`.

## Чтобы продолжить работу

1. `git clone https://github.com/UrbanMan2411/OOOKuban.git`
2. Для cockpit/ботов — воссоздать `cockpit/.env` из значений на сервере (или из ЛК маркетплейсов).
3. Истории прежних отдельных репо (бэкап): `UrbanMan2411/cockpit`, `greenpanda-deck`, `gp-variants`, `matreshka-price-tool`, `greenpanda-price-tool`.
