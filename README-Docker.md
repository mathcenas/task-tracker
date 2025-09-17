# TaskTracker Pro - Docker Deployment Guide

This guide will help you deploy TaskTracker Pro using Docker.

## 📋 Prerequisites

- Docker (version 20.10 or higher)
- Docker Compose (version 2.0 or higher)
- At least 1GB of available RAM
- Port 3000 available on your system

## 🚀 Quick Start

### Option 1: Using the Deployment Script (Recommended)

```bash
# Make the script executable
chmod +x docker-deploy.sh

# Run the deployment script
./docker-deploy.sh
```

### Option 2: Manual Deployment

```bash
# Build and start the application
docker-compose up --build -d

# Check if it's running
docker-compose ps
```

## 🌐 Accessing the Application

Once deployed, TaskTracker Pro will be available at:
- **Main Application**: http://localhost:3000
- **About Page**: http://localhost:3000/about

## 📊 Docker Commands

### Basic Operations
```bash
# Start the application
docker-compose up -d

# Stop the application
docker-compose down

# Restart the application
docker-compose restart

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f tasktracker
```

### Maintenance
```bash
# Update the application
docker-compose down
docker-compose up --build -d

# Clean up unused Docker resources
docker system prune -f

# Remove all containers and images
docker-compose down --rmi all --volumes --remove-orphans
```

### Monitoring
```bash
# Check container status
docker-compose ps

# Check resource usage
docker stats

# Check application health
curl http://localhost:3000
```

## 🔧 Configuration

### Port Configuration
To change the port, edit `docker-compose.yml`:
```yaml
ports:
  - "8080:80"  # Change 3000 to your desired port
```

### Environment Variables
Add environment variables in `docker-compose.yml`:
```yaml
environment:
  - NODE_ENV=production
  - CUSTOM_VAR=value
```

### Custom Nginx Configuration
Edit `nginx.conf` to customize:
- Security headers
- Caching policies
- Compression settings
- SSL configuration (for HTTPS)

## 🛡️ Security Features

The Docker setup includes:
- **Security headers** (XSS protection, content type options, etc.)
- **Gzip compression** for better performance
- **Static asset caching** for faster loading
- **Health checks** for container monitoring
- **Non-root user** in production container

## 📈 Performance Optimization

### Production Optimizations Included:
- **Multi-stage build** for smaller image size
- **Nginx** for efficient static file serving
- **Gzip compression** enabled
- **Asset caching** with proper headers
- **Health checks** for reliability

### Resource Limits (Optional)
Add to `docker-compose.yml`:
```yaml
deploy:
  resources:
    limits:
      memory: 512M
      cpus: '0.5'
```

## 🔍 Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Check what's using port 3000
lsof -i :3000

# Use a different port
# Edit docker-compose.yml and change "3000:80" to "8080:80"
```

**Container won't start:**
```bash
# Check logs
docker-compose logs tasktracker

# Check Docker daemon
sudo systemctl status docker
```

**Application not loading:**
```bash
# Check if container is running
docker-compose ps

# Check nginx logs
docker-compose exec tasktracker tail -f /var/log/nginx/error.log
```

**Build failures:**
```bash
# Clean build cache
docker builder prune

# Rebuild without cache
docker-compose build --no-cache
```

### Health Check
The application includes a health check that runs every 30 seconds:
```bash
# Manual health check
curl -f http://localhost:3000 || echo "Health check failed"
```

## 📦 Backup and Data

Since TaskTracker Pro uses localStorage, data is stored in the browser. For data persistence across deployments:

1. **Export data** from the application before updating
2. **Import data** after the new deployment
3. Consider implementing a **backup strategy** for important data

## 🔄 Updates

To update TaskTracker Pro:
```bash
# Pull latest changes (if using git)
git pull

# Rebuild and restart
./docker-deploy.sh
```

## 🌐 Production Deployment

For production deployment:

1. **Use HTTPS** - Configure SSL certificates
2. **Set up monitoring** - Use tools like Prometheus/Grafana
3. **Configure backups** - Regular data export/import
4. **Use a reverse proxy** - Nginx or Traefik for multiple services
5. **Set resource limits** - Prevent resource exhaustion

### Example Production docker-compose.yml:
```yaml
version: '3.8'
services:
  tasktracker:
    build: .
    restart: always
    ports:
      - "3000:80"
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

## 📞 Support

If you encounter issues:
1. Check the logs: `docker-compose logs -f`
2. Verify Docker installation: `docker --version`
3. Check port availability: `netstat -tulpn | grep :3000`
4. Review this documentation for troubleshooting steps

---

**TaskTracker Pro** - Professional task management made simple! 🚀