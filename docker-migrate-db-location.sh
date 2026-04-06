#!/bin/bash

# Database Location Migration Script
# Moves database from old location to new location and adds payment columns

echo "🔧 Fixing database location and payment columns..."
echo "================================================="

CONTAINER_ID="d87e1322a308"

echo "✅ Using container: $CONTAINER_ID"
echo ""

# Check if old database exists at wrong location
echo "Checking database locations..."
docker exec $CONTAINER_ID ls -la /app/server/tasktracker.db 2>/dev/null && echo "❌ Found OLD database at /app/server/tasktracker.db"
docker exec $CONTAINER_ID ls -la /app/data/tasktracker.db 2>/dev/null && echo "✅ Found NEW database at /app/data/tasktracker.db"

echo ""
echo "Removing old database at wrong location..."
docker exec $CONTAINER_ID rm -f /app/server/tasktracker.db

echo ""
echo "Verifying current schema..."
docker exec $CONTAINER_ID sqlite3 /app/data/tasktracker.db ".schema tasks" | grep -i billed

if [ $? -eq 0 ]; then
    echo "✅ Payment columns already exist!"
else
    echo "Adding payment columns..."
    docker exec $CONTAINER_ID sqlite3 /app/data/tasktracker.db <<'EOF'
ALTER TABLE tasks ADD COLUMN billed BOOLEAN DEFAULT 0;
ALTER TABLE tasks ADD COLUMN billedAt DATETIME;
ALTER TABLE tasks ADD COLUMN paid BOOLEAN DEFAULT 0;
ALTER TABLE tasks ADD COLUMN paidAt DATETIME;
ALTER TABLE tasks ADD COLUMN invoiceNumber TEXT;
EOF
    echo "✅ Payment columns added!"
fi

echo ""
echo "🔄 Restarting container..."
docker restart $CONTAINER_ID

echo ""
echo "✅ Done! Database is now at the correct location with all columns."
echo ""
echo "📋 Features ready:"
echo "  • Supplies page: /supplies - Select and mark as billed"
echo "  • Payment Tracker: /supplies/payments - Monitor payments"
