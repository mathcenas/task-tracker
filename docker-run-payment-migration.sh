#!/bin/bash

# Payment Tracking Migration Script for Docker
echo "🔧 Running payment tracking migration..."
echo "========================================"

# Detect docker compose command (with or without hyphen)
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo "ERROR: Docker Compose is not installed."
    exit 1
fi

# Run the migration inside the container
echo "Running migration in Docker container..."
$DOCKER_COMPOSE exec tasktracker node /app/server/add-payment-tracking.cjs

if [ $? -eq 0 ]; then
    echo "✅ Payment tracking migration completed successfully!"
    echo ""
    echo "🔄 Restarting container to apply changes..."
    $DOCKER_COMPOSE restart tasktracker
    echo ""
    echo "✅ Done! The payment tracking feature is now active."
    echo ""
    echo "📋 New features available:"
    echo "  • Supplies page: Select and mark supplies as billed"
    echo "  • Payment Tracker: Monitor pending payments at /supplies/payments"
    echo ""
else
    echo "❌ Migration failed. Check the error above."
    exit 1
fi
