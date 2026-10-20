#!/usr/bin/env bash

set -euo pipefail

usage() {
  echo "Usage: $0 <portfolio|site-slug> [--dry-run]"
}

if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage
  exit 2
fi

site="$1"
mode="${2:-}"

if [[ -n "$mode" && "$mode" != "--dry-run" ]]; then
  usage
  exit 2
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
archive_dir="$(mktemp -d)"
trap 'rm -rf "$archive_dir"' EXIT

# Everything the main portfolio serves at the domain root. Only these entries are
# replaced on the server; small sites and other folders there are left alone.
portfolio_entries=(index.html site.css site.js sprite.js models.js scenes data assets)

if [[ "$site" == "portfolio" ]]; then
  for entry in "${portfolio_entries[@]}"; do
    [[ -e "$repo_root/$entry" ]] || {
      echo "Missing $entry for portfolio"
      exit 1
    }
  done
  tar -C "$repo_root" -czf "$archive_dir/site.tar.gz" "${portfolio_entries[@]}"
  public_url="https://nathanchengyi.com/"
else
  if [[ ! "$site" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ ]]; then
    echo "Invalid site slug: $site"
    exit 1
  fi

  case "$site" in
    assets|api|portfolio|www|data|scenes)
      echo "Reserved site slug: $site"
      exit 1
      ;;
  esac

  source_dir="$repo_root/sites/$site"
  [[ -f "$source_dir/index.html" ]] || {
    echo "Missing sites/$site/index.html"
    exit 1
  }
  tar -C "$source_dir" -czf "$archive_dir/site.tar.gz" .
  public_url="https://nathanchengyi.com/$site/"
fi

tar -tzf "$archive_dir/site.tar.gz" >/dev/null
echo "Validated deployable package for $public_url"

if [[ "$mode" == "--dry-run" ]]; then
  exit 0
fi

: "${DEPLOY_HOST:?DEPLOY_HOST is required}"
: "${DEPLOY_USER:?DEPLOY_USER is required}"
: "${DEPLOY_SSH_KEY_FILE:?DEPLOY_SSH_KEY_FILE is required}"
: "${DEPLOY_KNOWN_HOSTS_FILE:?DEPLOY_KNOWN_HOSTS_FILE is required}"

deploy_id="${GITHUB_RUN_ID:-manual}-$(date -u +%Y%m%d%H%M%S)"
remote_archive="/tmp/nathan-site-$deploy_id.tar.gz"
ssh_options=(
  -i "$DEPLOY_SSH_KEY_FILE"
  -o "UserKnownHostsFile=$DEPLOY_KNOWN_HOSTS_FILE"
  -o StrictHostKeyChecking=yes
  -o BatchMode=yes
)

scp "${ssh_options[@]}" "$archive_dir/site.tar.gz" \
  "$DEPLOY_USER@$DEPLOY_HOST:$remote_archive"

ssh "${ssh_options[@]}" "$DEPLOY_USER@$DEPLOY_HOST" \
  "bash -s -- '$site' '$deploy_id' '$remote_archive'" <<'REMOTE_SCRIPT'
set -euo pipefail

site="$1"
deploy_id="$2"
remote_archive="$3"
stage="/var/www/site-staging/$deploy_id"
backup="/var/www/site-backups/$site-$deploy_id"

cleanup() {
  sudo rm -rf "$stage"
  rm -f "$remote_archive"
}
trap cleanup EXIT

sudo mkdir -p "$stage" "$backup"
sudo tar --no-same-owner -xzf "$remote_archive" -C "$stage"

if [[ "$site" == "portfolio" ]]; then
  [[ -f "$stage/index.html" && -d "$stage/assets" ]]
  # Swap each packaged entry in, keeping the old one in the backup. index.html goes
  # last so the new page never loads before its scripts and styles are in place.
  sudo chmod -R u=rwX,go=rX "$stage"
  for entry in "$stage"/*; do
    name="$(basename "$entry")"
    [[ "$name" == "index.html" ]] && continue
    if [[ -e "/var/www/html/$name" ]]; then
      sudo mv "/var/www/html/$name" "$backup/$name"
    fi
    sudo mv "$entry" "/var/www/html/$name"
  done
  if [[ -e /var/www/html/index.html ]]; then
    sudo cp -a /var/www/html/index.html "$backup/index.html"
  fi
  sudo mv -f "$stage/index.html" /var/www/html/index.html
else
  [[ -f "$stage/index.html" ]]
  target="/var/www/html/$site"
  if [[ -e "$target" ]]; then
    sudo mv "$target" "$backup/site"
  fi
  sudo mv "$stage" "$target"
fi

sudo nginx -t
sudo systemctl reload nginx
REMOTE_SCRIPT

echo "Deployed $public_url"
