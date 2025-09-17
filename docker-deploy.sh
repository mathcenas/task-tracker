#!/bin/bash

# TaskTracker Pro Docker Deployment Script
echo "🚀 TaskTracker Pro Docker Deployment"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Stop existing containers
print_status "Stopping existing containers..."
docker-compose down

# Remove old images (optional)
read -p "Do you want to remove old Docker images? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Removing old images..."
    docker system prune -f
fi

# Build and start containers
print_status "Building and starting containers..."
docker-compose up --build -d

# Check if containers are running
if [ $? -eq 0 ]; then
    print_success "TaskTracker Pro is now running!"
    echo ""
    echo "🌐 Application URL: http://localhost:3000"
    echo "📊 Health Check: http://localhost:3000/about"
    echo ""
    echo "📋 Useful commands:"
    echo "  • View logs: docker-compose logs -f"
    echo "  • Stop app: docker-compose down"
    echo "  • Restart: docker-compose restart"
    echo "  • Update: ./docker-deploy.sh"
    echo ""
    
    # Wait a moment and check health
    print_status "Checking application health..."
    sleep 10
    
    if curl -f -s http://localhost:3000 > /dev/null; then
        print_success "Application is healthy and responding!"
    else
        print_warning "Application may still be starting up. Check logs with: docker-compose logs -f"
    fi
else
    print_error "Failed to start containers. Check the logs with: docker-compose logs"
    exit 1
fi