# Monitor Integration

The Monitor Integration feature allows you to connect external monitoring services via simple JSON endpoints.

## Overview

Instead of complex integrations with specific monitoring platforms, this system uses a simple JSON endpoint approach. Any monitoring service that can expose a JSON feed can be integrated.

## How It Works

1. **Add a Monitor Feed**
   - Go to Integrations > Monitors
   - Click "Add Feed"
   - Provide a name, JSON endpoint URL, and optionally assign to a client/project

2. **JSON Format Support**

The system supports two common JSON formats:

### Array Format
```json
[
  {
    "name": "Production Server",
    "status": "up",
    "responseTime": 45,
    "uptime": 99.9
  },
  {
    "name": "Database Server",
    "status": "down",
    "responseTime": 0,
    "uptime": 98.5
  }
]
```

### Object Format
```json
{
  "monitors": [
    {
      "name": "API Server",
      "status": "up",
      "responseTime": 120
    }
  ]
}
```

## Supported Fields

- `name` / `monitor` / `service` - Monitor name (required)
- `status` / `state` - Status value: "up", "down", "online", "offline", "active", "inactive", 1, 0, true, false
- `responseTime` / `response_time` / `latency` - Response time in milliseconds
- `uptime` / `availability` - Uptime percentage
- `lastCheck` / `checked_at` / `timestamp` - Last check timestamp

## Creating JSON Endpoints

### Static JSON File
Simply host a JSON file on your web server:
```bash
# Create a status.json file
echo '[{"name":"Web Server","status":"up","responseTime":45}]' > /var/www/status.json
```

### Dynamic Endpoint
Create a simple script that generates JSON:

**PHP Example:**
```php
<?php
header('Content-Type: application/json');
$monitors = [
    ["name" => "Web Server", "status" => "up", "responseTime" => 45],
    ["name" => "Database", "status" => "up", "responseTime" => 12]
];
echo json_encode($monitors);
?>
```

**Node.js Example:**
```javascript
app.get('/status.json', (req, res) => {
  const monitors = [
    { name: "API Server", status: "up", responseTime: 85 },
    { name: "Worker Queue", status: "up", responseTime: 23 }
  ];
  res.json(monitors);
});
```

**Python/Flask Example:**
```python
@app.route('/status.json')
def status():
    monitors = [
        {"name": "App Server", "status": "up", "responseTime": 67},
        {"name": "Cache Server", "status": "up", "responseTime": 5}
    ]
    return jsonify(monitors)
```

## Integration with Popular Services

### Uptime Kuma
Uptime Kuma can expose a status page API. Configure your status page and use the JSON endpoint.

### Custom Scripts
Write simple monitoring scripts that output JSON:

```bash
#!/bin/bash
# Simple ping monitor
echo '['
echo '{"name":"Google DNS","status":"'$(ping -c 1 8.8.8.8 > /dev/null 2>&1 && echo "up" || echo "down")'"}'
echo ']'
```

## Features

- **Enable/Disable Feeds** - Toggle feeds on/off without deleting them
- **Client/Project Assignment** - Optionally assign monitors to specific clients or projects
- **Manual Refresh** - Refresh status on demand
- **Multiple Feeds** - Add as many feeds as needed
- **Real-time Status** - See monitor status at a glance with color-coded indicators

## Benefits Over Uptime Kuma Integration

1. **Simpler** - No complex authentication or WebSocket connections
2. **More Stable** - Just HTTP requests to JSON endpoints
3. **Universal** - Works with any monitoring service that can output JSON
4. **Flexible** - Support for multiple JSON formats and field names
5. **Lightweight** - No background services or persistent connections

## Security Notes

- JSON endpoints should be publicly accessible or behind basic authentication
- Use HTTPS for production endpoints
- Consider rate limiting on your JSON endpoints
- No sensitive data should be exposed in the JSON feed
