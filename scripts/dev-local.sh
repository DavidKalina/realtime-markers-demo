#!/bin/bash
set -euo pipefail

# =============================================================================
# dev-local.sh — Single-command local development environment
#
# Boots Docker services (http mode), starts ngrok tunnels, wires URLs into
# the mobile app .env, and launches Expo Metro bundler.
#
# Usage:
#   pnpm dev:local              # Full stack with ngrok (physical device ready)
#   pnpm dev:local:no-ngrok     # Docker + Expo only (simulator / localhost)
#   bash scripts/dev-local.sh --force-env   # Regenerate root .env
#   bash scripts/dev-local.sh --no-ngrok    # Skip ngrok
# =============================================================================

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; }
header()  { echo -e "\n${BLUE}${BOLD}=== $1 ===${NC}"; }

# --- Resolve repo root (script lives in scripts/) ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# --- Defaults ---
USE_NGROK=true
FORCE_ENV=false
NGROK_PID=""
EXPO_PID=""
DOCKER_STARTED=false
NGROK_CONFIG="/tmp/ngrok-dev-local.yml"

# --- Parse flags ---
usage() {
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  --no-ngrok    Skip ngrok tunnels (simulator/localhost only)"
  echo "  --force-env   Regenerate root .env from env.local.example"
  echo "  -h, --help    Show this help message"
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-ngrok)   USE_NGROK=false; shift ;;
    --force-env)  FORCE_ENV=true; shift ;;
    -h|--help)    usage ;;
    *)            error "Unknown option: $1"; usage ;;
  esac
done

# --- Cleanup on exit ---
cleanup() {
  echo ""
  header "Shutting down"

  if [[ -n "$EXPO_PID" ]] && kill -0 "$EXPO_PID" 2>/dev/null; then
    info "Stopping Expo (PID $EXPO_PID)..."
    kill "$EXPO_PID" 2>/dev/null || true
    wait "$EXPO_PID" 2>/dev/null || true
  fi

  if [[ -n "$NGROK_PID" ]] && kill -0 "$NGROK_PID" 2>/dev/null; then
    info "Stopping ngrok (PID $NGROK_PID)..."
    kill "$NGROK_PID" 2>/dev/null || true
    wait "$NGROK_PID" 2>/dev/null || true
  fi

  if [[ "$DOCKER_STARTED" == "true" ]]; then
    info "Stopping Docker services..."
    docker compose -f docker-compose.yml -f docker-compose.http.yml -f docker-compose.local.yml down
  fi

  # Clean up temp ngrok config
  rm -f "$NGROK_CONFIG"

  info "Done. Goodbye!"
}
trap cleanup EXIT INT TERM

# =============================================================================
# 1. Check prerequisites
# =============================================================================
header "Checking prerequisites"

MISSING=()
for cmd in docker pnpm node; do
  if ! command -v "$cmd" &>/dev/null; then
    MISSING+=("$cmd")
  fi
done

if [[ "$USE_NGROK" == "true" ]] && ! command -v ngrok &>/dev/null; then
  MISSING+=("ngrok")
fi

if [[ ${#MISSING[@]} -gt 0 ]]; then
  error "Missing required tools: ${MISSING[*]}"
  echo "  Install them and try again."
  exit 1
fi

# Check Docker daemon
if ! docker info &>/dev/null; then
  error "Docker daemon is not running. Start Docker Desktop and try again."
  exit 1
fi

info "All prerequisites OK"

# =============================================================================
# 2. Generate root .env if needed
# =============================================================================
header "Environment setup"

if [[ ! -f .env ]] || [[ "$FORCE_ENV" == "true" ]]; then
  if [[ -f env.local.example ]]; then
    cp env.local.example .env
    info "Created .env from env.local.example"
  else
    error "env.local.example not found. Cannot generate .env"
    exit 1
  fi
else
  info "Using existing .env (use --force-env to regenerate)"
fi

# =============================================================================
# 3. Start Docker services
# =============================================================================
header "Starting Docker services"

info "Building and starting containers..."
docker compose \
  -f docker-compose.yml \
  -f docker-compose.http.yml \
  -f docker-compose.local.yml \
  up -d --build

DOCKER_STARTED=true
info "Docker containers started"

# =============================================================================
# 4. Wait for services to be healthy
# =============================================================================
header "Waiting for services"

HEALTH_TIMEOUT=120
HEALTH_INTERVAL=3

wait_for_service() {
  local name="$1"
  local url="$2"
  local elapsed=0

  while [[ $elapsed -lt $HEALTH_TIMEOUT ]]; do
    if curl -sf "$url" >/dev/null 2>&1; then
      info "$name is ready"
      return 0
    fi
    sleep "$HEALTH_INTERVAL"
    elapsed=$((elapsed + HEALTH_INTERVAL))
  done

  error "$name failed to start within ${HEALTH_TIMEOUT}s"
  echo "  Check logs: docker compose logs $name"
  return 1
}

# Wait for each service (order matches dependency chain)
wait_for_service "Backend"          "http://localhost:3000/api/health"
wait_for_service "WebSocket"        "http://localhost:8081/health"
wait_for_service "Filter Processor" "http://localhost:8082/health"
wait_for_service "Web Dashboard"    "http://localhost:3001"

info "All Docker services healthy"

# =============================================================================
# 5. Start ngrok tunnels (if enabled)
# =============================================================================
API_URL="http://localhost:3000"
WS_URL="ws://localhost:8081"

if [[ "$USE_NGROK" == "true" ]]; then
  header "Starting ngrok tunnels"

  # Kill any existing ngrok process
  if pgrep -x ngrok >/dev/null 2>&1; then
    warn "Killing existing ngrok process..."
    pkill -x ngrok 2>/dev/null || true
    sleep 1
  fi

  # Write temp ngrok config
  cat > "$NGROK_CONFIG" <<'NGROK_EOF'
version: "3"
tunnels:
  api:
    proto: http
    addr: 3000
  ws:
    proto: http
    addr: 8081
NGROK_EOF

  # Start ngrok in background
  ngrok start --all --config "$NGROK_CONFIG" > /dev/null 2>&1 &
  NGROK_PID=$!
  info "ngrok started (PID $NGROK_PID)"

  # Poll for tunnel API to be ready
  info "Waiting for ngrok tunnels..."
  NGROK_TIMEOUT=30
  NGROK_ELAPSED=0
  while [[ $NGROK_ELAPSED -lt $NGROK_TIMEOUT ]]; do
    if curl -sf http://localhost:4040/api/tunnels >/dev/null 2>&1; then
      break
    fi
    sleep 1
    NGROK_ELAPSED=$((NGROK_ELAPSED + 1))
  done

  if [[ $NGROK_ELAPSED -ge $NGROK_TIMEOUT ]]; then
    error "ngrok failed to start within ${NGROK_TIMEOUT}s"
    exit 1
  fi

  # Extract tunnel URLs using node
  TUNNELS_JSON=$(curl -sf http://localhost:4040/api/tunnels)

  API_URL=$(echo "$TUNNELS_JSON" | node -e "
    const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
    const tunnel = data.tunnels.find(t => t.name === 'api');
    if (tunnel) {
      const url = tunnel.public_url.replace('http://', 'https://');
      process.stdout.write(url);
    } else {
      process.exit(1);
    }
  ")

  WS_URL=$(echo "$TUNNELS_JSON" | node -e "
    const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
    const tunnel = data.tunnels.find(t => t.name === 'ws');
    if (tunnel) {
      const url = tunnel.public_url.replace('http://', 'wss://').replace('https://', 'wss://');
      process.stdout.write(url);
    } else {
      process.exit(1);
    }
  ")

  info "API tunnel:       $API_URL"
  info "WebSocket tunnel: $WS_URL"
fi

# =============================================================================
# 6. Write mobile app .env
# =============================================================================
header "Configuring mobile app"

MOBILE_ENV="apps/mobile-app/.env"

cat > "$MOBILE_ENV" <<EOF
# Auto-generated by dev-local.sh. Do not edit manually.
# Re-run pnpm dev:local to regenerate with fresh ngrok URLs.
EXPO_PUBLIC_API_URL=$API_URL
EXPO_PUBLIC_WEB_SOCKET_URL=$WS_URL
EOF

info "Wrote $MOBILE_ENV"

# =============================================================================
# 7. Print summary
# =============================================================================
header "Development environment ready"

echo ""
echo -e "  ${BOLD}Docker Services${NC}"
echo -e "    Backend:          ${GREEN}http://localhost:3000${NC}"
echo -e "    WebSocket:        ${GREEN}http://localhost:8081${NC}"
echo -e "    Filter Processor: ${GREEN}http://localhost:8082${NC}"
echo -e "    Web Dashboard:    ${GREEN}http://localhost:3001${NC}"
echo -e "    PostgreSQL:       ${GREEN}localhost:5432${NC}"
echo -e "    Redis:            ${GREEN}localhost:6379${NC}"

if [[ "$USE_NGROK" == "true" ]]; then
  echo ""
  echo -e "  ${BOLD}ngrok Tunnels (for physical devices)${NC}"
  echo -e "    API:              ${GREEN}$API_URL${NC}"
  echo -e "    WebSocket:        ${GREEN}$WS_URL${NC}"
  echo -e "    Inspector:        ${GREEN}http://localhost:4040${NC}"
fi

echo ""
echo -e "  ${BOLD}Logs${NC}"
echo -e "    All services:     ${YELLOW}pnpm logs${NC}"
echo -e "    Backend only:     ${YELLOW}pnpm logs:backend${NC}"
echo ""
echo -e "  ${BOLD}Ctrl+C to stop everything (Expo + ngrok + Docker)${NC}"
echo ""

# =============================================================================
# 8. Start Expo (foreground — interactive Metro UI)
# =============================================================================
header "Starting Expo"

cd apps/mobile-app
npx expo start &
EXPO_PID=$!

# Wait for Expo process to finish (user presses Ctrl+C)
wait "$EXPO_PID" 2>/dev/null || true
