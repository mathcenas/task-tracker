#!/bin/bash

# Quick Database Fix Script for Docker
# This adds the payment tracking columns to the existing database

echo "🔧 Adding payment tracking columns to database..."
echo "================================================="

# Detect docker compose command
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo "❌ ERROR: Docker Compose is not installed."
    exit 1
fi

# Check if container is running
if ! $DOCKER_COMPOSE ps | grep -q "task-tracker-tasktracker-1"; then
    echo "❌ ERROR: TaskTracker container is not running."
    echo "Start it with: $DOCKER_COMPOSE up -d"
    exit 1
fi

echo "✅ Container is running"
echo ""
echo "Adding columns to database..."

# Add the columns directly using SQLite commands
$DOCKER_COMPOSE exec -T task-tracker-tasktracker-1 sqlite3 /app/server/tasktracker.db <<'EOF'
-- Add payment tracking columns if they don't exist
ALTER TABLE tasks ADD COLUMN billed BOOLEAN DEFAULT 0;
ALTER TABLE tasks ADD COLUMN billedAt DATETIME;
ALTER TABLE tasks ADD COLUMN paid BOOLEAN DEFAULT 0;
ALTER TABLE tasks ADD COLUMN paidAt DATETIME;
ALTER TABLE tasks ADD COLUMN invoiceNumber TEXT;

-- Verify columns were added
.schema tasks
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Database columns added successfully!"
    echo ""
    echo "🔄 Restarting container..."
    $DOCKER_COMPOSE restart task-tracker-tasktracker-1

    echo ""
    echo "✅ Done! Payment tracking is now active."
    echo ""
    echo "📋 New features:"
    echo "  • Supplies page: /supplies - Select and mark as billed"
    echo "  • Payment Tracker: /supplies/payments - Monitor payments"
    echo ""
else
    echo ""
    echo "⚠️  Some columns might already exist (this is OK)"
    echo "🔄 Restarting container anyway..."
    $DOCKER_COMPOSE restart task-tracker-tasktracker-1
    echo ""
    echo "✅ Container restarted. Try using the payment features."
fi
