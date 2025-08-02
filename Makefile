# Realtime Markers Demo - Development Shortcuts
# Usage: make <command>

.PHONY: help dev build start lint format test clean docker-up docker-down docker-build docker-ngrok docker-dev docker-prod logs logs-backend logs-websocket logs-filter logs-dashboard shell-backend shell-websocket shell-filter shell-dashboard shell-postgres reset-db migrate seed

# Default target
help:
	@echo "Available commands:"
	@echo ""
	@echo "Development:"
	@echo "  dev          - Start all apps in development mode"
	@echo "  build        - Build all apps"
	@echo "  start        - Start all apps in production mode"
	@echo "  lint         - Run ESLint on all files"
	@echo "  format       - Format code with Prettier"
	@echo "  test         - Run tests for all apps"
	@echo ""
	@echo "Docker Operations:"
	@echo "  docker-up    - Start all services with docker-compose"
	@echo "  docker-down  - Stop all services"
	@echo "  docker-build - Build all Docker images"
	@echo "  docker-ngrok - Start services with ngrok configuration"
	@echo "  docker-dev   - Start services with development configuration"
	@echo "  docker-prod  - Start services with production configuration"
	@echo ""
	@echo "Logs:"
	@echo "  logs         - Show logs for all services"
	@echo "  logs-backend - Show backend logs"
	@echo "  logs-websocket - Show websocket logs"
	@echo "  logs-filter  - Show filter-processor logs"
	@echo "  logs-dashboard - Show web-dashboard logs"
	@echo ""
	@echo "Shell Access:"
	@echo "  shell-backend - Open shell in backend container"
	@echo "  shell-websocket - Open shell in websocket container"
	@echo "  shell-filter - Open shell in filter-processor container"
	@echo "  shell-dashboard - Open shell in web-dashboard container"
	@echo "  shell-postgres - Open shell in postgres container"
	@echo ""
	@echo "Database:"
	@echo "  reset-db     - Reset database (drop and recreate)"
	@echo "  migrate      - Run database migrations"
	@echo "  seed         - Seed database with initial data"

# Development commands
dev:
	pnpm dev

build:
	pnpm build

start:
	pnpm start

lint:
	pnpm lint

format:
	pnpm format

test:
	pnpm --parallel -r run test

clean:
	rm -rf node_modules
	rm -rf apps/*/node_modules
	rm -rf packages/*/node_modules
	pnpm install

# Docker commands
docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-build:
	docker compose build

docker-ngrok:
	docker compose -f docker-compose.yml -f docker-compose.ngrok.yml up -d

docker-ngrok-build:
	docker compose -f docker-compose.yml -f docker-compose.ngrok.yml build --no-cache
	docker compose -f docker-compose.yml -f docker-compose.ngrok.yml up -d

docker-dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

docker-prod:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Logs
logs:
	docker compose logs -f

logs-backend:
	docker compose logs -f backend

logs-websocket:
	docker compose logs -f websocket

logs-filter:
	docker compose logs -f filter-processor

logs-dashboard:
	docker compose logs -f web-dashboard

# Shell access
shell-backend:
	docker compose exec backend sh

shell-websocket:
	docker compose exec websocket sh

shell-filter:
	docker compose exec filter-processor sh

shell-dashboard:
	docker compose exec web-dashboard sh

shell-postgres:
	docker compose exec postgres psql -U postgres -d markersdb

# Database operations
reset-db:
	docker compose down
	docker volume rm realtime-markers-demo_postgres_data
	docker compose up -d postgres
	@echo "Waiting for postgres to be ready..."
	@sleep 10
	docker compose exec backend pnpm migration:run

migrate:
	docker compose exec backend pnpm migration:run

seed:
	docker compose exec backend pnpm seed

# Quick development helpers
quick-dev:
	@echo "Starting development environment..."
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
	@echo "Development environment started!"

quick-ngrok:
	@echo "Starting ngrok environment..."
	docker compose -f docker-compose.yml -f docker-compose.ngrok.yml up -d
	@echo "Ngrok environment started!"

status:
	@echo "Service Status:"
	docker compose ps

restart:
	docker compose restart

restart-backend:
	docker compose restart backend

restart-websocket:
	docker compose restart websocket

restart-filter:
	docker compose restart filter-processor

restart-dashboard:
	docker compose restart web-dashboard 