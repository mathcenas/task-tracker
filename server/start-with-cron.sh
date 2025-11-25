#!/bin/sh

# Initialize database
echo "Initializing database..."
node /app/server/init-db.js

# Run migrations
echo "Running migrations..."
node /app/server/migrate.js

# Set up cron job for daily backup at 2 AM
echo "0 2 * * * cd /app && node /app/server/backup-cron.js >> /var/log/cron.log 2>&1" > /tmp/crontab.txt

# Install cron job
crontab /tmp/crontab.txt

# Start cron daemon
crond -f -l 2 &

# Start the main application
echo "Starting application..."
node /app/server/index.js
