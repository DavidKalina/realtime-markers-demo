# Deployment Guide

This guide covers setting up your realtime-markers-demo application both locally and on a DigitalOcean droplet.

## 🏠 Local Development Setup

### Prerequisites

- Docker Desktop installed
- Git
- Node.js (for development tools)

### Quick Start

1. **Clone the repository:**

```bash
git clone <your-repo-url>
cd realtime-markers-demo
```

2. **Create environment file:**

```bash
# Copy the example environment file
cp .env.example .env

# Edit with your local settings
nano .env
```

3. **Set localhost domains in `.env`:**

```bash
# Local Development Environment Variables
POSTGRES_USER=postgres
POSTGRES_PASSWORD=devpassword
POSTGRES_DB=markersdb

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=devredispassword

# JWT Configuration (use any random strings for dev)
JWT_SECRET=dev-jwt-secret-key
REFRESH_SECRET=dev-refresh-secret-key

# Host Configuration (Localhost with namespaces)
API_HOST=api.localhost
DASHBOARD_HOST=dashboard.localhost
WEBSOCKET_HOST=ws.localhost
FILTER_PROCESSOR_HOST=filter.localhost
ADMINER_HOST=adminer.localhost

# Optional: Add your real API keys for full testing
OPENAI_API_KEY=your_openai_key
MAPBOX_GEOCODING_TOKEN=your_mapbox_token
GOOGLE_GEOCODING_API_KEY=your_google_key
```

4. **Start with development overrides:**

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

5. **Verify everything is working:**

```bash
# Test all services
curl -I http://api.localhost/api/health
curl -I http://dashboard.localhost
curl -I http://ws.localhost/health
curl -I http://filter.localhost/health
curl -I http://adminer.localhost

# Check Traefik dashboard
open http://localhost:8080
```

### Local Development Workflow

```bash
# Start services
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# View logs
docker-compose logs -f

# Rebuild a specific service
docker-compose build backend
docker-compose up -d backend

# Stop services
docker-compose down

# Clean up everything
docker-compose down -v --rmi all
```

### Local Testing

- **API Backend**: `http://api.localhost`
- **Web Dashboard**: `http://dashboard.localhost`
- **WebSocket**: `ws://ws.localhost`
- **Filter Processor**: `http://filter.localhost`
- **Adminer (Database)**: `http://adminer.localhost`
- **Traefik Dashboard**: `http://localhost:8080`

## ☁️ DigitalOcean Droplet Setup

### Prerequisites

- DigitalOcean account
- Domain name (optional but recommended)
- SSH key configured

### Step 1: Create Droplet

1. **Create a new droplet:**

   - **Image**: Ubuntu 22.04 LTS
   - **Size**: Basic → Regular → 2GB RAM / 1 vCPU (minimum)
   - **Region**: Choose closest to your users
   - **Authentication**: SSH key
   - **Add tags**: `markers-app`

2. **Note the droplet IP address**

### Step 2: Initial Server Setup

1. **SSH into your droplet:**

```bash
ssh root@YOUR_DROPLET_IP
```

2. **Update system:**

```bash
apt update && apt upgrade -y
```

3. **Install Docker and Docker Compose:**

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose-plugin

# Add user to docker group
usermod -aG docker $USER

# Logout and login again, or run:
newgrp docker
```

4. **Install additional tools:**

```bash
apt install -y curl wget git nano
```

### Step 3: Deploy Application

1. **Clone your repository:**

```bash
git clone <your-repo-url>
cd realtime-markers-demo
```

2. **Create production environment file:**

```bash
nano .env
```

3. **Add production environment variables:**

```bash
# Database Configuration
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_production_password
POSTGRES_DB=markersdb

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your_secure_redis_password

# Traefik Configuration
TRAEFIK_EMAIL=admin@yourdomain.com

# Domain Configuration (REQUIRED)
API_HOST=api.yourdomain.com
DASHBOARD_HOST=dashboard.yourdomain.com
WEBSOCKET_HOST=ws.yourdomain.com
FILTER_PROCESSOR_HOST=filter.yourdomain.com
ADMINER_HOST=adminer.yourdomain.com

# JWT Configuration
JWT_SECRET=your_very_secure_jwt_secret
REFRESH_SECRET=your_very_secure_refresh_secret

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Geocoding Configuration
MAPBOX_GEOCODING_TOKEN=your_mapbox_token
GOOGLE_GEOCODING_API_KEY=your_google_geocoding_key

# OAuth Credentials
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_IOS_CLIENT_ID=your_google_ios_client_id
GOOGLE_ANDROID_CLIENT_ID=your_google_android_client_id
FACEBOOK_CLIENT_ID=your_facebook_client_id
FACEBOOK_CLIENT_SECRET=your_facebook_client_secret

# Stripe Configuration
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
STRIPE_PRICE_ID=your_stripe_price_id

# Image Storage Configuration
ENABLE_IMAGE_STORAGE=false
DO_SPACE_ENDPOINT=https://nyc3.digitaloceanspaces.com
DO_SPACE_REGION=nyc3
DO_SPACE_BUCKET=event-images
DO_SPACE_ACCESS_KEY=your_do_space_access_key
DO_SPACE_SECRET_KEY=your_do_space_secret_key
DO_SPACE_PUBLIC_URL=https://nyc3.digitaloceanspaces.com

# Web Dashboard Configuration
WEB_DASHBOARD_DOCKERFILE=apps/web-dashboard/Dockerfile
WEB_DASHBOARD_NODE_ENV=production
WEB_DASHBOARD_COMMAND=pnpm start
```

### Step 4: Configure DNS (If Using Domain)

1. **Add A records to your domain:**

```
api.yourdomain.com     A    YOUR_DROPLET_IP
dashboard.yourdomain.com A    YOUR_DROPLET_IP
ws.yourdomain.com      A    YOUR_DROPLET_IP
filter.yourdomain.com  A    YOUR_DROPLET_IP
adminer.yourdomain.com A    YOUR_DROPLET_IP
```

2. **Wait for DNS propagation** (can take up to 24 hours)

### Step 5: Deploy with Production Overrides

```bash
# Deploy with production configuration
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Step 6: Configure Firewall

1. **Create firewall script:**

```bash
nano configure-firewall.sh
```

2. **Add the firewall configuration script** (see `scripts/configure-firewall.sh`)

3. **Run the script:**

```bash
chmod +x configure-firewall.sh
export DIGITALOCEAN_TOKEN=your_do_api_token
./configure-firewall.sh
```

### Step 7: Verify Deployment

```bash
# Test all services
curl -I https://api.yourdomain.com/api/health
curl -I https://dashboard.yourdomain.com
curl -I https://ws.yourdomain.com/health
curl -I https://filter.yourdomain.com/health
curl -I https://adminer.yourdomain.com

# Check SSL certificates
curl -I https://api.yourdomain.com/api/health
```

## 🔧 Production Management

### Monitoring

```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs -f traefik
docker-compose logs -f backend
docker-compose logs -f websocket

# Check resource usage
docker stats
```

### Updates

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Or restart specific service
docker-compose restart backend
```

### Backup

```bash
# Backup database
docker-compose exec postgres pg_dump -U postgres markersdb > backup.sql

# Backup volumes
docker run --rm -v realtime-markers-demo_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz -C /data .
```

### Troubleshooting

```bash
# Check if containers are running
docker-compose ps

# Check service health
docker-compose exec backend curl -f http://localhost:3000/api/health

# Check Traefik configuration
curl http://localhost:8080/api/rawdata | jq '.http.routers'

# View detailed logs
docker-compose logs -f traefik | grep ERROR
```

## 🚀 Quick Commands Reference

### Local Development

```bash
# Start
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Stop
docker-compose down

# Logs
docker-compose logs -f
```

### Production

```bash
# Start
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Update
git pull && docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Backup
docker-compose exec postgres pg_dump -U postgres markersdb > backup_$(date +%Y%m%d).sql
```

## 🎯 Success Indicators

### Local Development

- ✅ All services accessible via localhost
- ✅ No SSL complications
- ✅ Easy debugging
- ✅ Hot reloading support

### Production

- ✅ All services accessible via HTTPS
- ✅ Automatic SSL certificates
- ✅ Proper firewall configuration
- ✅ Health monitoring
- ✅ Resource optimization

Your deployment is now **stupid-easy** for both local development and production! 🎉
