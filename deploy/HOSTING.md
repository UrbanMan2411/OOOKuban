# Перенос greenpanda на свой сервер (193.124.59.187)

Полный раннбук. Статика + cockpit (Node) + Telegram-бот, за nginx с HTTPS.

## Что где
| Адрес | Что | Источник |
|---|---|---|
| `https://<домен>/` | лендинг GreenPanda | `index.html` + `assets/` |
| `/variants/` | варианты лендинга | `gp-variants/` |
| `/presentations/` | презентации | `presentations/` |
| `/deck/` `/price/` `/matreshka/` | Vite-приложения | сборки с `--base` |
| `https://app.<домен>/` | cockpit: дашборд `/store`, витрина `/shop`, API `/api` | Node (`server/index.js`) |
| — (демон) | Telegram-бот (todo/встречи) | `tgbot/`, systemd |

Хранилище cockpit — **файлы на диске** (`/var/lib/greenpanda/cockpit`), а не Vercel Blob.
Код это поддерживает автоматически: при заданном `STORAGE_DIR` и отсутствии
`BLOB_READ_WRITE_TOKEN` включается файловый режим (проверено локально).

## Предусловия (делает владелец)
1. **DNS:** `<домен>`, `www.<домен>` и `app.<домен>` → `193.124.59.187` (A-записи).
2. **Доступ по ключу** (я не ввожу root-пароль). На маке:
   ```
   ssh-copy-id -i ~/.ssh/greenpanda_deploy.pub root@193.124.59.187
   ```
3. После настройки — **сменить root-пароль** (он засветился в чате) и отключить вход по паролю.

## Развёртывание (по шагам)
```bash
# 0) залить provision на сервер и выполнить (один раз)
scp -i ~/.ssh/greenpanda_deploy deploy/provision.sh root@SERVER:/root/
ssh -i ~/.ssh/greenpanda_deploy root@SERVER 'bash /root/provision.sh'

# 1) собрать всё локально и залить код
SERVER=root@193.124.59.187 KEY=~/.ssh/greenpanda_deploy bash deploy/deploy.sh

# 2) положить .env-файлы (из шаблонов deploy/*.env.example), заполнив значения
scp -i ~/.ssh/greenpanda_deploy cockpit.env root@SERVER:/opt/greenpanda/cockpit/.env
scp -i ~/.ssh/greenpanda_deploy tgbot.env   root@SERVER:/opt/greenpanda/tgbot/.env

# 3) systemd-юниты
scp -i ~/.ssh/greenpanda_deploy deploy/cockpit.service deploy/tgbot.service root@SERVER:/etc/systemd/system/
ssh -i ~/.ssh/greenpanda_deploy root@SERVER 'systemctl daemon-reload && systemctl enable --now cockpit tgbot'

# 4) nginx + TLS (после того как DNS уже резолвится)
ssh -i ~/.ssh/greenpanda_deploy root@SERVER \
  'DOMAIN=<домен> APP_DOMAIN=app.<домен> EMAIL=<почта> bash /opt/greenpanda/_deploy/setup-nginx.sh'

# 5) Telegram: webhook магазина + кнопка меню
#   setWebhook → https://app.<домен>/api/shop/bot
#   BotFather Menu Button → https://app.<домен>/shop
```

## Известные нюансы
- **Telegram Mini App требует HTTPS** — поэтому нужен домен (`app.<домен>`), на голый IP сертификат не выдаётся.
- **Бот (tgbot)**: запись/транскрипция встреч сделана под Mac (Playwright + аудио-устройство, `caffeinate`). На headless-сервере todo/планировщик работают, а захват аудио видеозвонка — скорее всего нет без доработки. Включать осознанно.
- **Vercel** можно оставить как есть для отката; полностью уходить не обязательно.
- Деплой-папку (`deploy/`) залить на сервер в `/opt/greenpanda/_deploy/` (deploy.sh можно дополнить — сейчас она нужна только для setup-nginx.sh на сервере).
