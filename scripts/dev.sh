#!/bin/bash

# Realtime Markers Demo - Development Script
# Source this file to add aliases: source scripts/dev.sh

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

# Docker compose aliases
alias dc-up="docker compose up -d"
alias dc-down="docker compose down"
alias dc-build="docker compose build"
alias dc-logs="docker compose logs -f"
alias dc-ps="docker compose ps"

# Ngrok specific aliases
alias dc-ngrok="docker compose -f docker-compose.yml -f docker-compose.ngrok.yml up -d"
alias dc-ngrok-build="docker compose -f docker-compose.yml -f docker-compose.ngrok.yml build --no-cache && docker compose -f docker-compose.yml -f docker-compose.ngrok.yml up -d"
alias dc-ngrok-logs="docker compose -f docker-compose.yml -f docker-compose.ngrok.yml logs -f"

# Development aliases
alias dc-dev="docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d"
alias dc-prod="docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d"

# Service-specific aliases
alias dc-logs-backend="docker compose logs -f backend"
alias dc-logs-ws="docker compose logs -f websocket"
alias dc-logs-filter="docker compose logs -f filter-processor"
alias dc-logs-dashboard="docker compose logs -f web-dashboard"

# Shell access aliases
alias dc-shell-backend="docker compose exec backend sh"
alias dc-shell-ws="docker compose exec websocket sh"
alias dc-shell-filter="docker compose exec filter-processor sh"
alias dc-shell-dashboard="docker compose exec web-dashboard sh"
alias dc-shell-postgres="docker compose exec postgres psql -U postgres -d markersdb"

# Database aliases
alias dc-reset-db="docker compose down && docker volume rm realtime-markers-demo_postgres_data && docker compose up -d postgres && sleep 10 && docker compose exec backend pnpm migration:run"
alias dc-migrate="docker compose exec backend pnpm migration:run"
alias dc-seed="docker compose exec backend pnpm seed"

# Development helpers
alias dev-clean="rm -rf node_modules apps/*/node_modules packages/*/node_modules && pnpm install"
alias dev-lint="pnpm lint"
alias dev-format="pnpm format"
alias dev-test="pnpm --parallel -r run test"

# Quick status check
alias status="docker compose ps"

# Function to show all available aliases
show_aliases() {
    print_header "Available Aliases"
    echo ""
    echo "Docker Compose:"
    echo "  dc-up, dc-down, dc-build, dc-logs, dc-ps"
    echo ""
    echo "Ngrok:"
    echo "  dc-ngrok, dc-ngrok-build, dc-ngrok-logs"
    echo ""
    echo "Environments:"
    echo "  dc-dev, dc-prod"
    echo ""
    echo "Service Logs:"
    echo "  dc-logs-backend, dc-logs-ws, dc-logs-filter, dc-logs-dashboard"
    echo ""
    echo "Shell Access:"
    echo "  dc-shell-backend, dc-shell-ws, dc-shell-filter, dc-shell-dashboard, dc-shell-postgres"
    echo ""
    echo "Database:"
    echo "  dc-reset-db, dc-migrate, dc-seed"
    echo ""
    echo "Development:"
    echo "  dev-clean, dev-lint, dev-format, dev-test"
    echo ""
    echo "Status:"
    echo "  status"
}

# Function to restart all services
restart_all() {
    print_status "Restarting all services..."
    docker compose restart
    print_status "All services restarted!"
}

# Function to restart specific service
restart_service() {
    if [ -z "$1" ]; then
        print_error "Please specify a service name"
        echo "Usage: restart_service <service-name>"
        return 1
    fi
    print_status "Restarting service: $1"
    docker compose restart "$1"
    print_status "Service $1 restarted!"
}

# Function to check service health
health_check() {
    print_header "Service Health Check"
    docker compose ps
    echo ""
    print_status "Checking service endpoints..."
    
    # Check backend
    if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
        print_status "Backend: OK"
    else
        print_warning "Backend: Not responding"
    fi
    
    # Check websocket
    if curl -s http://localhost:8081/health > /dev/null 2>&1; then
        print_status "WebSocket: OK"
    else
        print_warning "WebSocket: Not responding"
    fi
    
    # Check filter-processor
    if curl -s http://localhost:8082/health > /dev/null 2>&1; then
        print_status "Filter Processor: OK"
    else
        print_warning "Filter Processor: Not responding"
    fi
    
    # Check web-dashboard
    if curl -s http://localhost:3001 > /dev/null 2>&1; then
        print_status "Web Dashboard: OK"
    else
        print_warning "Web Dashboard: Not responding"
    fi
}

# Function to show logs for all services in parallel
logs_all() {
    print_status "Showing logs for all services (Ctrl+C to stop)..."
    docker compose logs -f --tail=100 &
    sleep 2
    print_status "Logs started. Press Ctrl+C to stop."
    wait
}

# Function to clean up Docker resources
cleanup() {
    print_header "Cleaning up Docker resources"
    print_status "Stopping all containers..."
    docker compose down
    print_status "Removing unused containers..."
    docker container prune -f
    print_status "Removing unused images..."
    docker image prune -f
    print_status "Removing unused volumes..."
    docker volume prune -f
    print_status "Cleanup complete!"
}

# Function to show project info
project_info() {
    print_header "Realtime Markers Demo"
    echo "Project: Realtime Markers Demo"
    echo "Services:"
    echo "  - Backend (Node.js/Express)"
    echo "  - WebSocket (Real-time communication)"
    echo "  - Filter Processor (Event filtering)"
    echo "  - Web Dashboard (React/Next.js)"
    echo "  - Mobile App (React Native/Expo)"
    echo "  - PostgreSQL (Database)"
    echo "  - Redis (Cache/Message broker)"
    echo ""
    echo "Quick Start:"
    echo "  1. make docker-ngrok    # Start with ngrok config"
    echo "  2. make logs            # View logs"
    echo "  3. make status          # Check service status"
    echo ""
    echo "For more commands: make help"
}

# Export functions so they can be used
export -f show_aliases restart_all restart_service health_check logs_all cleanup project_info

# Print welcome message
print_header "Development Environment Loaded"
echo "Available commands:"
echo "  show_aliases     - Show all available aliases"
echo "  restart_all      - Restart all services"
echo "  restart_service  - Restart specific service"
echo "  health_check     - Check service health"
echo "  logs_all         - Show all service logs"
echo "  cleanup          - Clean up Docker resources"
echo "  project_info     - Show project information"
echo ""
echo "Or use: make help"
echo "" 