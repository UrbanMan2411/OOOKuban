#!/usr/bin/env bash
# Render nginx config + get TLS certs. Run on the server as root, after DNS for
# DOMAIN, www.DOMAIN and APP_DOMAIN points to this server.
#   DOMAIN=example.com APP_DOMAIN=app.example.com EMAIL=you@example.com bash setup-nginx.sh
set -euo pipefail
DOMAIN="${DOMAIN:?set DOMAIN}"
APP_DOMAIN="${APP_DOMAIN:?set APP_DOMAIN}"
EMAIL="${EMAIL:?set EMAIL for Let's Encrypt}"
HERE="$(dirname "$0")"

export DOMAIN APP_DOMAIN
envsubst '$DOMAIN $APP_DOMAIN' < "$HERE/nginx.conf.tmpl" > /etc/nginx/sites-available/greenpanda
ln -sf /etc/nginx/sites-available/greenpanda /etc/nginx/sites-enabled/greenpanda
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Issue + install certs (also flips the http blocks to https).
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" -d "$APP_DOMAIN" \
  --non-interactive --agree-tos -m "$EMAIL" --redirect

systemctl reload nginx
echo "TLS ready: https://$DOMAIN and https://$APP_DOMAIN"
