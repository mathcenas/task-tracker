# Uptime Kuma Integration

TaskTracker Pro now includes built-in integration with Uptime Kuma to automatically create tasks when your monitored services go down or recover.

## Features

- **Real-time monitoring** via Socket.io connection
- **Automatic task creation** when monitors go down
- **Optional recovery tasks** when services come back up
- **Configurable minimum downtime** to avoid false positives
- **Auto-assignment** to specific clients and projects
- **Rich incident details** including response times, tags, and URLs

## Quick Setup

### 1. Deploy with Docker Compose (Recommended)

Edit `docker-compose.yml` and uncomment the Uptime Kuma service:

```yaml
services:
  uptime-kuma:
    image: louislam/uptime-kuma:latest
    container_name: uptime-kuma
    ports:
      - "3001:3001"
    volumes:
      - uptime_kuma_data:/app/data
    restart: unless-stopped
    networks:
      - app-network

volumes:
  uptime_kuma_data:
```

Then restart:
```bash
docker-compose down
docker-compose up -d
```

### 2. Configure in TaskTracker

1. Navigate to **Integrations > Uptime Kuma** in the sidebar
2. Enable the integration
3. Enter your Uptime Kuma URL: `http://uptime-kuma:3001` (for Docker) or `http://localhost:3001` (local)
4. Enter your Uptime Kuma credentials
5. Configure task creation preferences
6. Click **Save Configuration**
7. Click **Connect** to start monitoring

## Configuration Options

### Connection Settings
- **Uptime Kuma URL**: The Socket.io endpoint (include protocol and port)
- **Username**: Your Uptime Kuma admin username
- **Password**: Your Uptime Kuma admin password

### Task Creation
- **Create tasks on DOWN**: Automatically create high-priority incident tasks when monitors fail
- **Create tasks on UP**: Create low-priority recovery tasks when services recover
- **Minimum Downtime**: Only create tasks if downtime exceeds this duration (in seconds)
  - Set to `0` to create tasks immediately
  - Set to `60` to ignore brief outages under 1 minute

### Auto-Assignment
- **Default Client**: Automatically assign all Uptime Kuma tasks to a specific client
- **Default Project**: Automatically assign all Uptime Kuma tasks to a specific project

## Task Details

When a monitor goes down, TaskTracker creates a task with:

### Title
- **DOWN**: `🚨 INCIDENT: [Monitor Name] is DOWN - [Error Message]`
- **UP**: `✅ RECOVERY: [Monitor Name] is back UP`

### Task Type
- `incident` (automatic)

### Priority
- **DOWN**: `high`
- **UP**: `low`

### Status
- **DOWN**: `not_started`
- **UP**: `completed`

### Notes Include
- Monitor name and type
- URL or hostname
- Status and error message
- Timestamp with timezone
- Response time (if available)
- Tags from Uptime Kuma
- Expected status codes

### Example Task
```
Monitor: Production API
Type: http
URL: https://api.example.com
Status: DOWN
Message: ETIMEDOUT
Time: 2025-11-05 14:30:00 (UTC)
Response Time: null
Tags: production, critical
Expected Status Codes: ["200-299"]
```

## Docker Networking

When running both services with Docker Compose:

1. Both containers are on the `app-network`
2. Use container name as hostname: `http://uptime-kuma:3001`
3. No need to expose ports if only TaskTracker needs access
4. Can keep Uptime Kuma's web UI on port 3001 for direct access

### Example Docker Compose Network
```yaml
networks:
  app-network:
    driver: bridge
```

All services on `app-network` can communicate by container name.

## Troubleshooting

### Connection Failed
- Verify Uptime Kuma is running: `docker ps | grep uptime-kuma`
- Check the URL format includes protocol: `http://` or `https://`
- For Docker, use container name, not `localhost`
- Verify credentials are correct
- Check TaskTracker logs: `docker logs tasktracker`

### No Tasks Being Created
- Verify "Create tasks on DOWN" is enabled
- Check if minimum downtime threshold is too high
- Ensure monitors are actively sending heartbeats
- Verify client/project IDs exist if auto-assignment is enabled
- Check connection status in the UI (should show "Connected")

### Tasks Not Auto-Assigned
- Verify the client and project IDs exist in your database
- Check that you've saved the configuration after selecting defaults
- Manually assign the first task to verify database permissions

## API Endpoints

The integration adds these authenticated endpoints:

- `GET /api/uptime-kuma/config` - Get current configuration
- `POST /api/uptime-kuma/config` - Save configuration
- `GET /api/uptime-kuma/status` - Get connection status
- `POST /api/uptime-kuma/connect` - Manual connect
- `POST /api/uptime-kuma/disconnect` - Manual disconnect

## Auto-Connect on Startup

TaskTracker automatically attempts to connect to Uptime Kuma on startup if:
1. The integration is enabled
2. A valid URL is configured
3. Credentials are provided

Check server logs to see connection status:
```bash
docker logs tasktracker -f
```

Look for:
- `🔌 Connecting to Uptime Kuma at...`
- `✅ Connected to Uptime Kuma`
- `✅ Logged in to Uptime Kuma successfully`
- `📊 Received N monitors from Uptime Kuma`
- `💓 Heartbeat for "Monitor Name": DOWN/UP`

## Security Notes

- Credentials are stored in the database (not encrypted in SQLite)
- All API endpoints require authentication
- Socket.io connection uses credentials for Uptime Kuma auth
- Consider using environment variables for sensitive credentials in production
- The password is never sent to the frontend after initial save

## Support

For issues or questions:
1. Check the integration status in the UI
2. Review server logs for connection errors
3. Verify Uptime Kuma is accessible from TaskTracker container
4. Test Uptime Kuma credentials directly in Uptime Kuma UI
