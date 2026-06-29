#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Brew dependencies"
if ! command -v brew >/dev/null; then
  echo "Установите Homebrew: https://brew.sh"; exit 1
fi
brew list ffmpeg >/dev/null 2>&1 || brew install ffmpeg
brew list --cask blackhole-2ch >/dev/null 2>&1 || brew install --cask blackhole-2ch

echo "==> Python 3.12"
# onnxruntime (зависимость faster-whisper) пока не собирают под 3.13/3.14
PY=""
for cand in python3.12 /opt/homebrew/bin/python3.12 /usr/local/bin/python3.12; do
  if command -v "$cand" >/dev/null; then PY="$cand"; break; fi
done
if [ -z "$PY" ]; then
  echo "Ставлю python@3.12 через brew…"
  brew install python@3.12
  PY="$(brew --prefix python@3.12)/bin/python3.12"
fi
echo "Использую: $PY ($($PY --version))"

echo "==> Python venv"
# если venv был создан на другой версии — пересоздаём
if [ -d .venv ]; then
  CURRENT_PY="$(.venv/bin/python -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo "")"
  if [ "$CURRENT_PY" != "3.12" ]; then
    echo "venv был на Python $CURRENT_PY, пересоздаю на 3.12"
    rm -rf .venv
  fi
fi
if [ ! -d .venv ]; then
  "$PY" -m venv .venv
fi
. .venv/bin/activate
pip install -U pip wheel
pip install -e .

echo "==> Playwright Chromium"
python -m playwright install chromium

echo "==> .env"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Создал .env — впишите BOT_TOKEN и OPENAI_API_KEY"
fi

cat <<'EOF'

==> Готово. Дальше руками:

1) Audio MIDI Setup → создать Multi-Output Device:
   - встроенные динамики + BlackHole 2ch
   - выбрать его как системный выход когда заходите в звонок,
     чтобы и слышать собеседников, и писать.

2) Системные настройки → Конфиденциальность → Микрофон, Запись экрана:
   разрешить Terminal/iTerm/IDE откуда запускаете бота.

3) Создайте бота у @BotFather, токен в .env (BOT_TOKEN=...)

4) В .env впишите OPENAI_BASE_URL/API_KEY/MODEL.

5) Запуск:
   ./scripts/run.sh

EOF
