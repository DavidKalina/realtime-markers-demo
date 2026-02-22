#!/usr/bin/env bash
#
# Manual deploy script — run this directly on the droplet.
# For automated deploys, the GitHub Actions workflow handles everything.
#
# Usage:
#   cd /opt/realtime-markers-demo
#   ./scripts/deploy.sh
#
set -euo pipefail

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

echo "==> Pulling latest code..."
git fetch origin master
git reset --hard origin/master

echo "==> Pulling images from registry..."
$COMPOSE pull

echo "==> Running database migrations..."
$COMPOSE up -d postgres redis
sleep 10
$COMPOSE run --rm -w /app/apps/backend backend pnpm migration:run || echo "Warning: migration step failed (non-fatal)"

echo "==> Starting services..."
$COMPOSE up -d --remove-orphans

echo "==> Cleaning up old images..."
docker image prune -f

echo ""
echo "==> Deploy complete! Service status:"
$COMPOSE ps
