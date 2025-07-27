# Traefik Setup Guide

This guide explains how to use the new Traefik reverse proxy setup for your realtime-markers-demo project.

## What Changed

### Before (Manual Nginx)

- Manual nginx configuration required
- Manual SSL certificate management
- Manual port exposure for each service
- Complex deployment process

### After (Traefik)

- Automatic service discovery
- Automatic SSL certificates via Let's Encrypt
- No manual port exposure needed
- Simple deployment with just environment variables

## Environment Variables

Create a `.env` file with these variables:

```bash
# Database Configuration
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=markersdb

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password_here

# Traefik Configuration (REQUIRED - no fallbacks)
TRAEFIK_EMAIL=admin@mapmoji.app

# Domain Configuration for Traefik (REQUIRED - no fallbacks)
API_HOST=api.mapmoji.app
DASHBOARD_HOST=dashboard.mapmoji.app
WEBSOCKET_HOST=ws.mapmoji.app
FILTER_PROCESSOR_HOST=filter.mapmoji.app
ADMINER_HOST=adminer.mapmoji.app

# JWT Configuration
JWT_SECRET=your_jwt_secret_here
REFRESH_SECRET=your_refresh_secret_here

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Geocoding Configuration
MAPBOX_GEOCODING_TOKEN=your_mapbox_token_here
GOOGLE_GEOCODING_API_KEY=your_google_geocoding_key_here

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

**Important:** The main `docker-compose.yml` file is now domain-agnostic and requires all `*_HOST` environment variables to be set. There are no fallback values.

## Deployment

### Development

```bash
# Start all services with Traefik
docker-compose up -d

# View Traefik dashboard (development only)
# http://localhost:8080
```

### Production

```bash
# Start with production overrides
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Service URLs

Once deployed, your services will be available at:

- **API Backend**: `https://api.mapmoji.app`
- **Web Dashboard**: `https://dashboard.mapmoji.app`
- **WebSocket Service**: `https://ws.mapmoji.app`
- **Filter Processor**: `https://filter.mapmoji.app`
- **Adminer (Dev only)**: `https://adminer.mapmoji.app`

## DNS Configuration

Make sure your domain points to your server's IP address:

```bash
# Add these A records to your DNS
api.mapmoji.app     A    YOUR_SERVER_IP
dashboard.mapmoji.app A    YOUR_SERVER_IP
ws.mapmoji.app      A    YOUR_SERVER_IP
filter.mapmoji.app  A    YOUR_SERVER_IP
adminer.mapmoji.app A    YOUR_SERVER_IP
```

## SSL Certificates

Traefik automatically:

- Obtains SSL certificates from Let's Encrypt
- Renews certificates automatically
- Handles HTTP to HTTPS redirects
- Stores certificates in the `traefik-certificates` volume

## Monitoring

### Traefik Dashboard (Development)

- URL: `http://localhost:8080`
- Shows all routes, services, and certificates
- Disabled in production for security

### Logs

```bash
# View Traefik logs
docker-compose logs traefik

# View specific service logs
docker-compose logs backend
docker-compose logs websocket
```

## Troubleshooting

### Certificate Issues

```bash
# Check certificate status
docker-compose exec traefik traefik version

# View certificate storage
docker-compose exec traefik ls -la /letsencrypt/
```

### Service Not Accessible

```bash
# Check if service is healthy
docker-compose ps

# Check service logs
docker-compose logs [service-name]

# Check Traefik configuration
docker-compose exec traefik traefik version
```

### Port Conflicts

If you have port conflicts:

```bash
# Check what's using ports 80/443
sudo lsof -i :80
sudo lsof -i :443

# Stop conflicting services
sudo systemctl stop nginx  # if using nginx
sudo systemctl stop apache2  # if using apache
```

## Migration from Nginx

1. **Backup your current setup**
2. **Update DNS records** to point to your server
3. **Deploy with Traefik** using the new docker-compose files
4. **Test all services** are accessible via HTTPS
5. **Remove old nginx configuration** once confirmed working

## Security Features

- **Automatic HTTPS**: All traffic encrypted
- **CORS Headers**: Properly configured for API access
- **Health Checks**: All services monitored
- **Resource Limits**: Production resource constraints
- **Security Options**: No new privileges for containers

## Benefits

✅ **Zero Manual Configuration**: Just set environment variables
✅ **Automatic SSL**: No more manual certificate management  
✅ **Service Discovery**: Automatic routing based on labels
✅ **Health Monitoring**: Built-in health checks and monitoring
✅ **Production Ready**: Resource limits and security hardening
✅ **Easy Scaling**: Add new services with just labels

Your deployment is now "stupid-easy"! 🎉
