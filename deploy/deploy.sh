#!/usr/bin/env bash
# Build everything locally and push to the server. Run from the greenpanda root
# on your machine (key-based SSH must already work).
#   SERVER=root@193.124.59.187 KEY=~/.ssh/greenpanda_deploy bash deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

SERVER="${SERVER:?set SERVER=root@IP}"
KEY="${KEY:-$HOME/.ssh/greenpanda_deploy}"
SSH="ssh -i $KEY -o StrictHostKeyChecking=accept-new"
RS="rsync -az -e \"$SSH\" --delete"
eval_rsync() { eval rsync -az -e "\"$SSH\"" "$@"; }

echo "== build cockpit =="
( cd cockpit && npm ci && npm run build )

echo "== build sub-apps with subpath bases =="
( cd deck && npm ci && npx vite build --base=/deck/ )
( cd price-tool && npm ci && npx vite build --base=/price/ )
( cd matreshka-price-tool && npm ci && npx vite build --base=/matreshka/ )

echo "== sync static sites → /var/www/greenpanda =="
eval_rsync index.html assets "$SERVER:/var/www/greenpanda/"
eval_rsync --delete gp-variants/ "$SERVER:/var/www/greenpanda/variants/"
eval_rsync --delete presentations/ "$SERVER:/var/www/greenpanda/presentations/"
eval_rsync --delete deck/dist/ "$SERVER:/var/www/greenpanda/deck/"
eval_rsync --delete price-tool/dist/ "$SERVER:/var/www/greenpanda/price/"
eval_rsync --delete matreshka-price-tool/dist/ "$SERVER:/var/www/greenpanda/matreshka/"

echo "== sync cockpit code → /opt/greenpanda/cockpit (preserve .env) =="
eval_rsync --delete --exclude node_modules --exclude .env \
  cockpit/api cockpit/server cockpit/dist cockpit/package.json cockpit/package-lock.json \
  "$SERVER:/opt/greenpanda/cockpit/"

echo "== sync tgbot code → /opt/greenpanda/tgbot (preserve .env, data) =="
eval_rsync --exclude .venv --exclude .env --exclude data --exclude '__pycache__' \
  tgbot/src tgbot/scripts tgbot/pyproject.toml "$SERVER:/opt/greenpanda/tgbot/"

echo "== install + restart on server =="
$SSH "$SERVER" 'bash -s' <<'REMOTE'
set -e
cd /opt/greenpanda/cockpit && npm ci --omit=dev
# tgbot venv (first run creates it)
cd /opt/greenpanda/tgbot
[ -d .venv ] || python3 -m venv .venv
./.venv/bin/pip install -q -e . || true
# storage dir perms
chown -R www-data:www-data /var/lib/greenpanda /opt/greenpanda /var/www/greenpanda
systemctl restart cockpit || true
systemctl restart tgbot || true
echo "restarted. cockpit:" ; systemctl is-active cockpit || true
REMOTE
echo "== done =="
