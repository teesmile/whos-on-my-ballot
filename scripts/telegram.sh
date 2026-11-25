#!/usr/bin/env bash
# Sends the text in the given file to the owner's Telegram chat (D-102). The bot token and chat ID come only from the
# environment (GitHub secrets TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID); nothing here prints them.
set -u
msg="${1:?message file}"
if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${TELEGRAM_CHAT_ID:-}" ]; then
  echo "Telegram secrets are not set; message not sent:"; cat "$msg"; exit 0
fi
code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" --data-urlencode "text@${msg}" --data-urlencode "disable_web_page_preview=true")
echo "Telegram: HTTP ${code}"
