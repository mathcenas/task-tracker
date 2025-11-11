# Public Status Page Setup Guide

This guide will help you set up and troubleshoot public status pages powered by Uptime Kuma.

## Prerequisites

1. **Uptime Kuma must be running and connected**
   - Go to **Integrations > Uptime Kuma**
   - Configure your Uptime Kuma URL (e.g., `10.8.8.21:3001` or `http://uptime-kuma:3001`)
   - Enter credentials and click **Save Configuration**
   - Click **Connect** to establish the connection
   - Wait for "Connected to Uptime Kuma" message

2. **Monitors must be configured in Uptime Kuma**
   - Log into your Uptime Kuma instance
   - Add monitors for the services you want to display
   - The status page will automatically show all monitors

## Creating a Status Page

1. Navigate to **Integrations > Status Pages**
2. Click **"New Status Page"**
3. Fill in the form:
   - **URL Slug**: A unique identifier (e.g., `my-company`) - this will be in your public URL
   - **Organization Name**: The title shown on your status page (e.g., "My Company")
   - **Description**: Optional subtitle (e.g., "Real-time status of our services")
   - **Enabled**: Check to make the page publicly accessible
4. Click **"Create Status Page"**

## Accessing Your Status Page

Your status page will be available at:
```
https://yourdomain.com/status/your-slug
```

For example, if your slug is `my-company`:
```
https://yourdomain.com/status/my-company
```

## Troubleshooting

### Issue: "Nothing is showing" on Status Pages management

**Check if the table exists:**

On your server, run:
```bash
npm run check:status-pages
```

This will:
- Check if the `status_pages` table exists
- Create it if missing
- List all existing status pages

In Docker:
```bash
docker exec tasktracker npm run check:status-pages
```

### Issue: "A status page with this slug already exists"

This means you're trying to create a page with a slug that's already in use. Either:
- Choose a different slug
- Edit the existing page instead
- Delete the old page first

### Issue: Status page shows "No monitors"

This means Uptime Kuma is not connected or has no monitors. Fix:

1. **Verify Uptime Kuma connection:**
   ```bash
   docker logs tasktracker | grep "Uptime Kuma"
   ```

   Look for:
   - ✅ Connected to Uptime Kuma
   - ✅ Logged in to Uptime Kuma successfully
   - 📊 Received monitors from Uptime Kuma

2. **Check for connection errors:**
   - ❌ Connection error: xhr poll error → URL is incorrect
   - ❌ Login failed → Credentials are incorrect

3. **Fix connection issues:**
   - Go to **Integrations > Uptime Kuma**
   - Verify URL format (protocol is optional): `10.8.8.21:3001` or `http://10.8.8.21:3001`
   - Verify credentials
   - Click **Save Configuration** then **Connect**

### Issue: "xhr poll error" in logs

This means the Socket.io connection to Uptime Kuma is failing.

**Solutions:**

1. **Check URL format:**
   - Correct: `10.8.8.21:3001` (protocol added automatically)
   - Correct: `http://10.8.8.21:3001`
   - Incorrect: `10.8.8.21` (missing port)

2. **Verify Uptime Kuma is accessible:**
   ```bash
   # From your server/container
   curl http://10.8.8.21:3001
   ```

3. **Check network connectivity:**
   - If using Docker, ensure both containers are on the same network
   - Verify firewall rules allow the connection
   - Test from browser to ensure Uptime Kuma is running

4. **Restart TaskTracker:**
   ```bash
   docker-compose restart tasktracker
   ```

### Issue: Public status page shows "Status page not found"

Possible causes:

1. **Status page is disabled:**
   - Go to **Integrations > Status Pages**
   - Find your page and click **Edit**
   - Ensure "Enable this status page" is checked

2. **Wrong slug in URL:**
   - Verify the slug in your URL matches exactly
   - Check for typos or case sensitivity

3. **Database issue:**
   - Run `npm run check:status-pages` to verify

## Features

### What's Displayed on the Public Status Page:

- **Overall Status Banner**
  - All Systems Operational (green)
  - Partial System Outage (yellow)
  - Major System Outage (red)

- **Monitor Cards** showing:
  - Service name
  - Service type (HTTP, Port, Ping, DNS, etc.)
  - Current status (Operational/Down)
  - Uptime percentage
  - Response time
  - Last check time
  - Tags from Uptime Kuma

- **Auto-refresh** every 30 seconds

### Security

- No authentication required for public viewing
- Only shows monitor status, not sensitive config
- Management requires authentication (admin only)

## Managing Multiple Status Pages

You can create multiple status pages for different purposes:

- `customer-facing` - Public status for customers
- `internal` - Internal team status page
- `client-name` - Client-specific status page

Each page will show all monitors from Uptime Kuma. If you need different monitors per page, you'll need to run separate Uptime Kuma instances.

## Embedding

You can embed the status page in an iframe:

```html
<iframe src="https://yourdomain.com/status/my-company"
        width="100%"
        height="800"
        frameborder="0">
</iframe>
```

## Next Steps

1. ✅ Connect Uptime Kuma
2. ✅ Add monitors in Uptime Kuma
3. ✅ Create your first status page
4. ✅ Test the public URL
5. 📧 Share the URL with customers
6. 🎨 Customize branding (organization name, description)

## Support

If you encounter issues:

1. Check logs: `docker logs tasktracker -f`
2. Run diagnostics: `npm run check:status-pages`
3. Verify Uptime Kuma connection
4. Restart services if needed

For connection issues, the most common fix is ensuring the URL format is correct and Uptime Kuma is accessible from the TaskTracker container.
