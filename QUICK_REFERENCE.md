# Quick Reference

## 🚀 Local Development

### Start Services

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

### Stop Services

```bash
docker-compose down
```

### View Logs

```bash
docker-compose logs -f
docker-compose logs -f backend
docker-compose logs -f traefik
```

### Rebuild Service

```bash
docker-compose build backend
docker-compose up -d backend
```

### Test Services

```bash
curl -I http://api.localhost/api/health
curl -I http://dashboard.localhost
curl -I http://ws.localhost/health
curl -I http://filter.localhost/health
curl -I http://adminer.localhost
```

### Traefik Dashboard

```bash
open http://localhost:8080
```

## ☁️ Production Deployment

### Start Services

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Update Services

```bash
git pull
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### Restart Service

```bash
docker-compose restart backend
```

### Check Status

```bash
docker-compose ps
docker stats
```

### Test Production

```bash
curl -I https://api.mapmoji.app/api/health
curl -I https://dashboard.mapmoji.app
curl -I https://ws.mapmoji.app/health
```

## 🔧 Troubleshooting

### Check Container Health

```bash
docker-compose ps
docker-compose exec backend curl -f http://localhost:3000/api/health
```

### View Traefik Configuration

```bash
curl http://localhost:8080/api/rawdata | jq '.http.routers'
```

### Check Logs for Errors

```bash
docker-compose logs -f traefik | grep ERROR
docker-compose logs -f backend | grep ERROR
```

### Reset Everything

```bash
docker-compose down -v --rmi all
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

## 📊 Monitoring

### Resource Usage

```bash
docker stats
```

### Service Health

```bash
docker-compose ps
```

### Log Monitoring

```bash
docker-compose logs -f traefik
docker-compose logs -f backend
docker-compose logs -f websocket
```

## 💾 Backup & Restore

### Backup Database

```bash
docker-compose exec postgres pg_dump -U postgres markersdb > backup.sql
```

### Backup Volumes

```bash
docker run --rm -v realtime-markers-demo_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz -C /data .
```

### Restore Database

```bash
docker-compose exec -T postgres psql -U postgres markersdb < backup.sql
```

## 🔐 Environment Variables

### Local Development (.env)

```bash
API_HOST=api.localhost
DASHBOARD_HOST=dashboard.localhost
WEBSOCKET_HOST=ws.localhost
FILTER_PROCESSOR_HOST=filter.localhost
ADMINER_HOST=adminer.localhost
```

### Production (.env)

```bash
API_HOST=api.mapmoji.app
DASHBOARD_HOST=dashboard.mapmoji.app
WEBSOCKET_HOST=ws.mapmoji.app
FILTER_PROCESSOR_HOST=filter.mapmoji.app
ADMINER_HOST=adminer.mapmoji.app
TRAEFIK_EMAIL=admin@mapmoji.app
```

## 🌐 Service URLs

### Local Development

- API: `http://api.localhost`
- Dashboard: `http://dashboard.localhost`
- WebSocket: `ws://ws.localhost`
- Filter: `http://filter.localhost`
- Adminer: `http://adminer.localhost`
- Traefik: `http://localhost:8080`

### Production

- API: `https://api.mapmoji.app`
- Dashboard: `https://dashboard.mapmoji.app`
- WebSocket: `wss://ws.mapmoji.app`
- Filter: `https://filter.mapmoji.app`
- Adminer: `https://adminer.mapmoji.app`

## 🚨 Emergency Commands

### Stop All Services

```bash
docker-compose down
```

### Remove Everything

```bash
docker-compose down -v --rmi all
docker system prune -a
```

### Check Port Conflicts

```bash
sudo lsof -i :80
sudo lsof -i :443
```

### Restart Docker

```bash
# macOS
osascript -e 'quit app "Docker"'
open -a Docker

# Linux
sudo systemctl restart docker
```
