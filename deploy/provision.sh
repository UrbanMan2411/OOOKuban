#!/usr/bin/env bash
# One-time server provisioning for greenpanda (Ubuntu/Debian). Run as root.
#   bash provision.sh
set -euo pipefail

echo "== apt base =="
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates gnupg git rsync ufw nginx \
  python3 python3-venv python3-pip

echo "== Node 20 (NodeSource) =="
if ! command -v node >/dev/null || [ "$(node -v | cut -dv -f2 | cut -d. -f1)" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "== certbot (Let's Encrypt) =="
apt-get install -y certbot python3-certbot-nginx

echo "== firewall =="
ufw allow 22/tcp || true
ufw allow OpenSSH || true
ufw allow 'Nginx Full' || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
yes | ufw enable || true

echo "== dirs =="
mkdir -p /var/www/greenpanda            # static sites web root
mkdir -p /opt/greenpanda                # app code (cockpit, tgbot)
mkdir -p /var/lib/greenpanda/cockpit    # cockpit filesystem storage (catalog/orders/photos)
mkdir -p /var/lib/greenpanda/tgbot      # bot data (sqlite, etc.)

echo "== done. Next: run deploy.sh from your machine, then setup-nginx.sh =="
