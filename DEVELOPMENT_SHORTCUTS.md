# Development Shortcuts

This project provides multiple ways to run common development commands quickly and easily.

## 🚀 Quick Start

### Option 1: Using Make (Recommended)
```bash
# Start with ngrok configuration (no cache)
make docker-ngrok-build

# View logs
make logs

# Check status
make status
```

### Option 2: Using pnpm scripts
```bash
# Start with ngrok configuration (no cache)
pnpm docker:ngrok-build

# View logs
pnpm logs

# Check status
pnpm status
```

### Option 3: Using shell aliases
```bash
# Load aliases
source scripts/dev.sh

# Start with ngrok configuration
dc-ngrok-build

# View logs
dc-logs
```

## 📋 Available Commands

### Docker Operations

| Command | Description |
|---------|-------------|
| `make docker-up` / `pnpm docker:up` | Start all services |
| `make docker-down` / `pnpm docker:down` | Stop all services |
| `make docker-build` / `pnpm docker:build` | Build all Docker images |
| `make docker-ngrok` / `pnpm docker:ngrok` | Start with ngrok configuration |
| `make docker-ngrok-build` / `pnpm docker:ngrok-build` | **Start with ngrok config (no cache)** |
| `make docker-dev` / `pnpm docker:dev` | Start with development configuration |
| `make docker-prod` / `pnpm docker:prod` | Start with production configuration |

### Logs

| Command | Description |
|---------|-------------|
| `make logs` / `pnpm logs` | Show all service logs |
| `make logs-backend` / `pnpm logs:backend` | Show backend logs |
| `make logs-websocket` / `pnpm logs:websocket` | Show websocket logs |
| `make logs-filter` / `pnpm logs:filter` | Show filter-processor logs |
| `make logs-dashboard` / `pnpm logs:dashboard` | Show web-dashboard logs |

### Shell Access

| Command | Description |
|---------|-------------|
| `make shell-backend` / `pnpm shell:backend` | Open shell in backend container |
| `make shell-websocket` / `pnpm shell:websocket` | Open shell in websocket container |
| `make shell-filter` / `pnpm shell:filter` | Open shell in filter-processor container |
| `make shell-dashboard` / `pnpm shell:dashboard` | Open shell in web-dashboard container |
| `make shell-postgres` / `pnpm shell:postgres` | Open PostgreSQL shell |

### Database Operations

| Command | Description |
|---------|-------------|
| `make reset-db` / `pnpm db:reset` | Reset database (drop and recreate) |
| `make migrate` / `pnpm db:migrate` | Run database migrations |
| `make seed` / `pnpm db:seed` | Seed database with initial data |

### Development

| Command | Description |
|---------|-------------|
| `make dev` / `pnpm dev` | Start all apps in development mode |
| `make build` / `pnpm build` | Build all apps |
| `make start` / `pnpm start` | Start all apps in production mode |
| `make lint` / `pnpm lint` | Run ESLint on all files |
| `make format` / `pnpm format` | Format code with Prettier |
| `make test` / `pnpm test` | Run tests for all apps |
| `make clean` | Clean node_modules and reinstall |

### Status & Health

| Command | Description |
|---------|-------------|
| `make status` / `pnpm status` | Show service status |
| `make restart` | Restart all services |
| `make restart-backend` | Restart backend service |
| `make restart-websocket` | Restart websocket service |
| `make restart-filter` | Restart filter-processor service |
| `make restart-dashboard` | Restart web-dashboard service |

## 🔧 Shell Aliases (when using `source scripts/dev.sh`)

### Docker Compose Aliases
- `dc-up` - Start all services
- `dc-down` - Stop all services
- `dc-build` - Build all Docker images
- `dc-logs` - Show all service logs
- `dc-ps` - Show service status

### Ngrok Aliases
- `dc-ngrok` - Start with ngrok configuration
- `dc-ngrok-build` - Start with ngrok config (no cache)
- `dc-ngrok-logs` - Show ngrok service logs

### Environment Aliases
- `dc-dev` - Start with development configuration
- `dc-prod` - Start with production configuration

### Service Log Aliases
- `dc-logs-backend` - Show backend logs
- `dc-logs-ws` - Show websocket logs
- `dc-logs-filter` - Show filter-processor logs
- `dc-logs-dashboard` - Show web-dashboard logs

### Shell Access Aliases
- `dc-shell-backend` - Open shell in backend container
- `dc-shell-ws` - Open shell in websocket container
- `dc-shell-filter` - Open shell in filter-processor container
- `dc-shell-dashboard` - Open shell in web-dashboard container
- `dc-shell-postgres` - Open PostgreSQL shell

### Database Aliases
- `dc-reset-db` - Reset database
- `dc-migrate` - Run migrations
- `dc-seed` - Seed database

### Development Aliases
- `dev-clean` - Clean and reinstall dependencies
- `dev-lint` - Run linting
- `dev-format` - Format code
- `dev-test` - Run tests

## 🛠️ Advanced Functions (when using `source scripts/dev.sh`)

### Health Check
```bash
health_check
```
Checks the health of all service endpoints.

### Restart Services
```bash
restart_all                    # Restart all services
restart_service backend        # Restart specific service
```

### Logs
```bash
logs_all                      # Show all service logs in parallel
```

### Cleanup
```bash
cleanup                       # Clean up Docker resources
```

### Project Info
```bash
project_info                  # Show project information
show_aliases                  # Show all available aliases
```

## 🎯 Most Common Commands

### For Development with Ngrok
```bash
# Start everything with ngrok (no cache)
make docker-ngrok-build

# View logs
make logs

# Check status
make status

# Access backend shell
make shell-backend
```

### For Quick Development
```bash
# Start development environment
make docker-dev

# View logs
make logs

# Restart a service
make restart-backend
```

### For Database Work
```bash
# Reset database
make reset-db

# Run migrations
make migrate

# Seed data
make seed
```

## 📝 Notes

- **No Cache Build**: Use `make docker-ngrok-build` or `pnpm docker:ngrok-build` when you want to rebuild images without cache
- **Development Mode**: The ngrok configuration uses the development Dockerfile for hot reloading
- **Health Checks**: Use `health_check` function to verify all services are responding
- **Logs**: Use `make logs` or `pnpm logs` to see real-time logs from all services

## 🆘 Help

```bash
# Show all available make commands
make help

# Show all available pnpm scripts
pnpm run

# Show all aliases (when using shell script)
show_aliases
``` 