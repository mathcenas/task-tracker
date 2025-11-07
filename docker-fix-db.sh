#!/bin/bash

# TaskTracker Database Fix Script for Docker
# Usage: ./docker-fix-db.sh [verify|fix|both]

CONTAINER_NAME="tasktracker-app"

echo "🐳 TaskTracker Database Fix Tool"
echo "================================"
echo ""

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "❌ Container '${CONTAINER_NAME}' is not running"
    echo ""
    echo "Available containers:"
    docker ps --format "  - {{.Names}}"
    echo ""
    echo "Please start the container first:"
    echo "  docker-compose up -d"
    exit 1
fi

echo "✅ Container '${CONTAINER_NAME}' is running"
echo ""

# Function to verify database
verify_db() {
    echo "🔍 Verifying database consistency..."
    echo "-----------------------------------"
    docker exec ${CONTAINER_NAME} npm run verify:status
    return $?
}

# Function to fix database
fix_db() {
    echo "🔧 Fixing database issues..."
    echo "---------------------------"
    docker exec ${CONTAINER_NAME} npm run fix:completed
    return $?
}

# Parse command
case "${1:-both}" in
    verify)
        verify_db
        ;;
    fix)
        fix_db
        ;;
    both)
        verify_db
        echo ""
        read -p "Do you want to fix the issues? (y/N) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            fix_db
            echo ""
            echo "✅ Running verification again..."
            echo ""
            verify_db
        else
            echo "Skipped fix. Run './docker-fix-db.sh fix' when ready."
        fi
        ;;
    *)
        echo "Usage: $0 [verify|fix|both]"
        echo ""
        echo "Commands:"
        echo "  verify - Check database for issues"
        echo "  fix    - Fix database issues"
        echo "  both   - Verify, ask, then fix (default)"
        exit 1
        ;;
esac
