# GreenPanda Telegram Bot

Telegram-бот для группового чата: ведёт todo-лист, создаёт встречи в Я.Телемост (через личную ссылку хоста) и автоматически транскрибирует их по завершению.

## Что умеет

**Todo:** `/add`, `/list`, `/my`, `/today`, `/done`, `/cancel`, `/edit`, `/assign`, `/due` — с напоминаниями за час и в момент дедлайна.

**Встречи:** `/meet_link` (раз привязать свою постоянную Telemost-ссылку), `/meet`, `/meet_now`, `/meetings`. Бот за 10 минут до начала шлёт напоминание, за 1 минуту — заходит в звонок гостем под именем «📝 GP Notetaker» и параллельно пишет аудио.

**Транскрипты:** после звонка — `.md` файл с таймкодами + LLM-саммари (TL;DR, ключевые темы, решения, action items). Можно вручную: reply на аудио/видео + `/transcribe`.

## Стек

| | |
|---|---|
| Бот | Python 3.11+ / aiogram 3 |
| БД | SQLite (WAL) |
| Планировщик | APScheduler (jobstore в SQLite) |
| Listener | Playwright Chromium + ffmpeg + BlackHole 2ch |
| ASR | faster-whisper, модель `medium`, CPU int8 |
| LLM | OpenAI-совместимый эндпоинт (любой `BASE_URL`) |

## Установка (macOS)

```bash
cd ~/greenpanda/tgbot
./scripts/setup_mac.sh
```

Скрипт поставит `ffmpeg`, `blackhole-2ch`, поднимет venv, установит зависимости и Playwright Chromium.

После этого — руками:

1. **Audio MIDI Setup** (`/Applications/Utilities/Audio MIDI Setup.app`):
   - Создайте *Multi-Output Device* со встроенными динамиками и **BlackHole 2ch**.
   - Когда заходите в звонок руками — переключайте системный выход на этот Multi-Output, чтобы и слышать собеседников, и писать. Listener-бот пишет напрямую с BlackHole, ему системный выход не важен.

2. **Системные настройки → Конфиденциальность**:
   - **Микрофон** → разрешить Terminal/iTerm/IDE.
   - **Запись экрана** → то же.

3. Создайте бота у [@BotFather](https://t.me/BotFather), скопируйте токен.

4. Заполните `.env` (он создался из `.env.example`):

```env
BOT_TOKEN=123456:AA...
ADMIN_TG_IDS=12345678
OPENAI_BASE_URL=https://your-endpoint/v1
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

5. Добавьте бота в групповой чат и сделайте админом (чтобы видел все сообщения, иначе TG режет non-command'ы).

## Запуск

```bash
./scripts/run.sh
```

`caffeinate` не даст Mac уснуть пока бот работает.

## Привязка Telemost-ссылки

В **личке** с ботом (не в группе):

```
/meet_link https://telemost.yandex.ru/j/12345
```

Это постоянная ссылка хоста. Каждый, кто хочет быть «хостом» встреч в `/meet … @host`, должен один раз её прислать.

⚠️ **Ограничение модели:** все встречи идут в комнату хоста, параллельные звонки в разных комнатах одного хоста невозможны.

## Известные хрупкости

- Селекторы кнопок «Войти/Присоединиться» в Telemost могут меняться — см. `src/listener/runner.py`, обновлять список `_try_click_join`.
- При первом заходе нового «гостя» Telemost может показать капчу — тогда бот не зайдёт. План Б: один раз руками авторизовать аккаунт в Chromium-профиле и переиспользовать `storage_state`.
- На Intel Mac `faster-whisper medium` идёт ~0.8× реалтайма. Если ноут перегревается — переключите `WHISPER_MODEL=small` в `.env`.

## Структура

```
src/
├── main.py              # точка входа
├── config.py            # pydantic-settings
├── db/                  # миграции + repo + dataclasses
├── handlers/            # хендлеры aiogram (todo, meetings, transcribe, start)
├── services/            # dates, scheduler, notifier, llm
├── listener/            # Playwright + recorder + controller
└── asr/                 # faster-whisper wrapper
```
