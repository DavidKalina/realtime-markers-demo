# Local Testing with Traefik

This guide covers different approaches for testing your Traefik setup locally.

## 🚀 Quick Start (Recommended)

### Option 1: Localhost Testing (Easiest)

```bash
# Start with development overrides
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Your services will be available at:
# - API: http://api.localhost
# - Dashboard: http://dashboard.localhost
# - WebSocket: http://ws.localhost
# - Filter Processor: http://filter.localhost
# - Adminer: http://adminer.localhost
# - Traefik Dashboard: http://localhost:8080
```

### Option 2: Custom Domain Testing

If you want to test with real domains:

1. **Add to your `/etc/hosts` file:**

```bash
sudo nano /etc/hosts

# Add these lines:
127.0.0.1 api.yourdomain.com
127.0.0.1 dashboard.yourdomain.com
127.0.0.1 ws.yourdomain.com
127.0.0.1 filter.yourdomain.com
127.0.0.1 adminer.yourdomain.com
```

2. **Use the main docker-compose.yml:**

```bash
docker-compose up -d
```

## 🌐 No Domain? No Problem!

If you don't have a domain, here are your options:

### Option A: Use Localhost (Recommended for Development)

```bash
# Set these in your .env file
API_HOST=api.localhost
DASHBOARD_HOST=dashboard.localhost
WEBSOCKET_HOST=ws.localhost
FILTER_PROCESSOR_HOST=filter.localhost
ADMINER_HOST=adminer.localhost

# Then use the dev override
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

### Option B: Use .local Domains (Alternative)

```bash
# Set these in your .env file
API_HOST=api.markers.local
DASHBOARD_HOST=dashboard.markers.local
WEBSOCKET_HOST=ws.markers.local
FILTER_PROCESSOR_HOST=filter.markers.local
ADMINER_HOST=adminer.markers.local

# Add to /etc/hosts
127.0.0.1 api.markers.local
127.0.0.1 dashboard.markers.local
127.0.0.1 ws.markers.local
127.0.0.1 filter.markers.local
127.0.0.1 adminer.markers.local
```

### Option C: Use IP Address (For Network Testing)

```bash
# Set these in your .env file (replace YOUR_IP with your actual IP)
API_HOST=api.192.168.1.100.nip.io
DASHBOARD_HOST=dashboard.192.168.1.100.nip.io
WEBSOCKET_HOST=ws.192.168.1.100.nip.io
FILTER_PROCESSOR_HOST=filter.192.168.1.100.nip.io
ADMINER_HOST=adminer.192.168.1.100.nip.io

# No /etc/hosts needed - nip.io resolves automatically
```

#### How to Find Your IP Address

**macOS/Linux:**

```bash
# Get your local IP address
ifconfig | grep "inet " | grep -v 127.0.0.1

# Or use ip command (Linux)
ip addr show | grep "inet " | grep -v 127.0.0.1

# Quick way to get just the IP
hostname -I  # Linux
ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}'  # macOS
```

**Windows:**

```bash
# Command Prompt
ipconfig | findstr "IPv4"

# PowerShell
Get-NetIPAddress | Where-Object {$_.AddressFamily -eq "IPv4" -and $_.IPAddress -notlike "127.*"}
```

**Example Output:**

```bash
# You might see something like:
# inet 10.0.0.74 netmask 0xffffff00 broadcast 10.0.0.255

# Then use 10.0.0.74 in your .env file:
API_HOST=api.10.0.0.74.nip.io
DASHBOARD_HOST=dashboard.10.0.0.74.nip.io
WEBSOCKET_HOST=ws.10.0.0.74.nip.io
FILTER_PROCESSOR_HOST=filter.10.0.0.74.nip.io
ADMINER_HOST=adminer.10.0.0.74.nip.io
```

**Benefits of nip.io:**

- ✅ No `/etc/hosts` editing needed
- ✅ Works from other devices on your network
- ✅ Automatically resolves to your IP
- ✅ Great for mobile app testing

### Option D: Use .test Domains (For Testing)

```bash
# Set these in your .env file
API_HOST=api.markers.test
DASHBOARD_HOST=dashboard.markers.test
WEBSOCKET_HOST=ws.markers.test
FILTER_PROCESSOR_HOST=filter.markers.test
ADMINER_HOST=adminer.markers.test

# Add to /etc/hosts
127.0.0.1 api.markers.test
127.0.0.1 dashboard.markers.test
127.0.0.1 ws.markers.test
127.0.0.1 filter.markers.test
127.0.0.1 adminer.markers.test
```

## 🔧 Environment Setup

### For Localhost Testing

Create a `.env` file with minimal settings:

```bash
# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=devpassword
POSTGRES_DB=markersdb

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=devredispassword

# JWT (use any random strings for dev)
JWT_SECRET=dev-jwt-secret-key
REFRESH_SECRET=dev-refresh-secret-key

# Host Configuration (No Domain)
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

### For Custom Domain Testing

Add the domain variables:

```bash
# Add these to your .env file
TRAEFIK_EMAIL=admin@yourdomain.com
API_HOST=api.yourdomain.com
DASHBOARD_HOST=dashboard.yourdomain.com
WEBSOCKET_HOST=ws.yourdomain.com
FILTER_PROCESSOR_HOST=filter.yourdomain.com
ADMINER_HOST=adminer.yourdomain.com
```

## 🧪 Testing Your Services

### 1. Health Checks

```bash
# Check if all services are running
docker-compose ps

# Check service health
docker-compose exec backend curl -f http://localhost:3000/api/health
docker-compose exec websocket curl -f http://localhost:8081/health
docker-compose exec filter-processor curl -f http://localhost:8082/health
```

### 2. API Testing

```bash
# Test backend API
curl -X GET http://api.localhost/api/health

# Test WebSocket (using wscat if installed)
npm install -g wscat
wscat -c ws://ws.localhost

# Test dashboard
curl -I http://dashboard.localhost
```

### 3. Database Testing

```bash
# Access Adminer
open http://adminer.localhost

# Or connect directly to PostgreSQL
docker-compose exec postgres psql -U postgres -d markersdb
```

## ✅ Verification Checklist

### Step 1: Check Container Status

```bash
# Verify all containers are running
docker-compose ps

# Expected output should show all services as "Up"
# - traefik
# - postgres
# - redis
# - backend
# - websocket
# - filter-processor
# - web-dashboard
# - adminer (if not using production)
```

### Step 2: Check Traefik Dashboard

```bash
# Open Traefik dashboard
open http://localhost:8080

# You should see:
# ✅ All your services listed under "HTTP"
# ✅ Routes configured for each service
# ✅ Services healthy and accessible
```

### Step 3: Test Service Accessibility

```bash
# Test each service through Traefik
curl -I http://api.10.0.0.74.nip.io/api/health
curl -I http://dashboard.10.0.0.74.nip.io
curl -I http://ws.10.0.0.74.nip.io/health
curl -I http://filter.10.0.0.74.nip.io/health
curl -I http://adminer.10.0.0.74.nip.io

# Expected: HTTP 200 OK responses
```

### Step 4: Check Traefik Logs

```bash
# View Traefik logs for routing information
docker-compose logs traefik | grep "router"

# You should see entries like:
# "router api@docker"
# "router dashboard@docker"
# etc.
```

### Step 5: Test from Different Devices

```bash
# From your phone (same network):
# Open browser and try:
# http://api.10.0.0.74.nip.io/api/health
# http://dashboard.10.0.0.74.nip.io

# From another computer on the network:
curl http://api.10.0.0.74.nip.io/api/health
```

### Step 6: Verify DNS Resolution

```bash
# Test that nip.io resolves correctly
nslookup api.10.0.0.74.nip.io
nslookup dashboard.10.0.0.74.nip.io

# Should return your IP: 10.0.0.74
```

### Step 7: Check Service Health Internally

```bash
# Verify services are healthy inside containers
docker-compose exec backend curl -f http://localhost:3000/api/health
docker-compose exec websocket curl -f http://localhost:8081/health
docker-compose exec filter-processor curl -f http://localhost:8082/health

# All should return 200 OK
```

## 🔍 Troubleshooting Verification

### If Services Aren't Accessible:

```bash
# 1. Check if Traefik is routing correctly
curl http://localhost:8080/api/rawdata | jq '.http.routers'

# 2. Check if services are registered
docker-compose exec traefik traefik version

# 3. Check service logs
docker-compose logs backend
docker-compose logs websocket

# 4. Check if ports are exposed correctly
docker-compose exec backend netstat -tlnp | grep 3000
```

### If nip.io Isn't Working:

```bash
# 1. Test basic DNS resolution
nslookup 10.0.0.74.nip.io

# 2. Test from different network
# Try from your phone's mobile data (should fail)
# Try from your phone's WiFi (should work)

# 3. Alternative: Use localhost for testing
API_HOST=api.localhost
DASHBOARD_HOST=dashboard.localhost
# ... etc
```

### DNS Resolution Troubleshooting

If you get "Could not resolve host" errors:

**Step 1: Test Basic nip.io Resolution**

```bash
# Test if nip.io works at all
nslookup 10.0.0.74.nip.io

# If this fails, try:
ping 10.0.0.74.nip.io
```

**Step 2: Check Your Network**

```bash
# Verify your IP is correct
ifconfig | grep "inet " | grep -v 127.0.0.1

# Check if you're behind a firewall or VPN
# VPNs can interfere with local network access
```

**Step 3: Alternative Solutions**

**Option A: Use localhost (Recommended)**

```bash
# Update your .env file to use localhost
API_HOST=api.localhost
DASHBOARD_HOST=dashboard.localhost
WEBSOCKET_HOST=ws.localhost
FILTER_PROCESSOR_HOST=filter.localhost
ADMINER_HOST=adminer.localhost

# Use the dev override
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Test with localhost
curl -I http://api.localhost/api/health
```

**Option B: Use /etc/hosts (Manual DNS)**

```bash
# Add to /etc/hosts
sudo nano /etc/hosts

# Add these lines:
127.0.0.1 api.markers.local
127.0.0.1 dashboard.markers.local
127.0.0.1 ws.markers.local
127.0.0.1 filter.markers.local
127.0.0.1 adminer.markers.local

# Update .env file
API_HOST=api.markers.local
DASHBOARD_HOST=dashboard.markers.local
WEBSOCKET_HOST=ws.markers.local
FILTER_PROCESSOR_HOST=filter.markers.local
ADMINER_HOST=adminer.markers.local

# Test
curl -I http://api.markers.local/api/health
```

**Option C: Use Direct IP (No DNS)**

```bash
# Update .env file to use your IP directly
API_HOST=10.0.0.74
DASHBOARD_HOST=10.0.0.74
WEBSOCKET_HOST=10.0.0.74
FILTER_PROCESSOR_HOST=10.0.0.74
ADMINER_HOST=10.0.0.74

# Test with port numbers
curl -I http://10.0.0.74:3000/api/health
curl -I http://10.0.0.74:3001
```

**Option D: Check Firewall/Network**

```bash
# Check if ports are blocked
sudo lsof -i :80
sudo lsof -i :443

# Check if Docker is binding to all interfaces
docker-compose ps
```

**Common Issues:**

- ✅ **VPN interference**: Disable VPN temporarily
- ✅ **Corporate firewall**: May block nip.io
- ✅ **Docker network**: Ensure containers are on same network
- ✅ **DNS cache**: Try `sudo dscacheutil -flushcache` (macOS) or restart network

### If Traefik Dashboard Shows Errors:

```bash
# 1. Check Traefik configuration
docker-compose exec traefik traefik version

# 2. View detailed Traefik logs
docker-compose logs -f traefik

# 3. Check if labels are correct
docker-compose exec traefik cat /proc/1/environ | tr '\0' '\n' | grep TRAEFIK
```

## 🎯 Success Indicators

You'll know it's working when:

✅ **All containers show "Up" status**  
✅ **Traefik dashboard shows all services**  
✅ **curl commands return 200 OK**  
✅ **Services accessible from phone**  
✅ **No errors in logs**  
✅ **DNS resolves correctly**

## 📱 Mobile App Testing

Once verified, test your mobile app:

```bash
# Update your mobile app's API base URL to:
# http://api.10.0.0.74.nip.io

# Update WebSocket URL to:
# ws://ws.10.0.0.74.nip.io
```

Your setup is working when you can access all services from any device on your network! 🎉

## 🔍 Monitoring & Debugging

### Traefik Dashboard

```bash
# Access Traefik dashboard
open http://localhost:8080

# This shows:
# - All routes and services
# - Certificate status
# - Request logs
# - Service health
```

### Logs

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f traefik
docker-compose logs -f backend
docker-compose logs -f websocket

# View Traefik access logs
docker-compose logs -f traefik | grep "access"
```

### Debug Traefik Configuration

```bash
# Check Traefik configuration
docker-compose exec traefik traefik version

# View Traefik dynamic configuration
curl http://localhost:8080/api/rawdata | jq .
```

## 🐛 Troubleshooting

### Port Conflicts

```bash
# Check what's using ports 80/443
sudo lsof -i :80
sudo lsof -i :443

# Stop conflicting services
sudo systemctl stop nginx  # if using nginx
sudo systemctl stop apache2  # if using apache
```

### Service Not Accessible

```bash
# Check if containers are running
docker-compose ps

# Check service health
docker-compose exec backend curl -f http://localhost:3000/api/health

# Check Traefik routes
curl http://localhost:8080/api/rawdata | jq '.http.routers'

# Check if service is registered with Traefik
docker-compose exec traefik traefik version
```

### SSL Certificate Issues (Custom Domain Testing)

```bash
# Check certificate status
docker-compose exec traefik ls -la /letsencrypt/

# View certificate logs
docker-compose logs traefik | grep -i cert

# For localhost testing, SSL is disabled by default
```

### DNS Resolution Issues

```bash
# Test localhost resolution
nslookup api.localhost
nslookup dashboard.localhost

# If using custom domains, test resolution
nslookup api.yourdomain.com
```

## 🧪 Testing Scenarios

### 1. Basic Connectivity

```bash
# Test all services are reachable
curl -I http://api.localhost/api/health
curl -I http://dashboard.localhost
curl -I http://ws.localhost/health
curl -I http://filter.localhost/health
curl -I http://adminer.localhost
```

### 2. API Integration Testing

```bash
# Test backend API endpoints
curl -X POST http://api.localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Test WebSocket connection
wscat -c ws://ws.localhost
```

### 3. Database Testing

```bash
# Test database connectivity
docker-compose exec backend npm run db:migrate
docker-compose exec backend npm run db:seed

# Test through Adminer
open http://adminer.localhost
```

### 4. Load Testing

```bash
# Install Apache Bench
sudo apt-get install apache2-utils  # Ubuntu/Debian
brew install httpd  # macOS

# Test API performance
ab -n 100 -c 10 http://api.localhost/api/health
```

## 🔄 Development Workflow

### Hot Reloading

```bash
# For development with hot reloading
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Make changes to your code
# Rebuild specific service
docker-compose build backend
docker-compose up -d backend
```

### Debug Mode

```bash
# Run with debug logging
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# View debug logs
docker-compose logs -f traefik | grep DEBUG
```

## 🎯 Best Practices

### 1. Use Localhost for Quick Testing

- Fastest setup
- No SSL complications
- Easy to debug

### 2. Use Custom Domains for Production-like Testing

- Tests SSL certificates
- Tests real domain routing
- More production-like environment

### 3. Monitor Resources

```bash
# Check resource usage
docker stats

# Monitor specific service
docker stats backend websocket
```

### 4. Clean Up

```bash
# Stop all services
docker-compose down

# Remove volumes (careful - this deletes data)
docker-compose down -v

# Clean up images
docker-compose down --rmi all
```

## 🚀 Next Steps

1. **Start with localhost testing** to verify everything works
2. **Test with custom domains** to verify SSL setup
3. **Test your mobile app** against the local API
4. **Set up CI/CD** to test against the Traefik setup
5. **Deploy to staging** with the same configuration

Your local testing is now as easy as `docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d`! 🎉
