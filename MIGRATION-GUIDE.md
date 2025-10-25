# Migration Guide - Recurring Tasks Update

## Changes Made

### 1. **Mobile Responsiveness**
- Updated Service Type Breakdown section for mobile devices
- Better padding and spacing on small screens
- Responsive grid layout starting at `sm` breakpoint

### 2. **Recurring Task Acceptance Flow**
- Added `accepted` and `accepted_at` fields to tasks
- Added `recurring_start_date` field to recurring_tasks
- Auto-generated recurring tasks now require acceptance before completion

### 3. **Recurring Task Start/End Dates**
- You can now set a start date (when to begin generating tasks)
- You can set an end date (when to stop generating tasks)
- Tasks respect these date boundaries

## How to Apply the Changes

### Option 1: Run the Migration Script

If you have an existing database, run this command to add the new columns:

```bash
npm run migrate
```

### Option 2: Restart the Server

The migrations will run automatically when the server starts:

```bash
# Stop your current server (Ctrl+C)
# Then restart it
npm run dev:full
```

### Option 3: For Docker Users

If running in Docker, restart the container:

```bash
docker-compose down
docker-compose up -d
```

## How to Test the Changes

### Testing Recurring Task Acceptance:

1. **Create a recurring task**:
   - Go to Quick Actions → Recurring
   - Create a new recurring task with today's date or earlier
   - Close the modal

2. **Generate the task**:
   - Re-open Quick Actions → Recurring
   - The modal will auto-generate overdue recurring tasks
   - Check your Weekly Dashboard

3. **Complete the task**:
   - Click the checkmark to complete a recurring task
   - You'll see a yellow warning box
   - Check "Accept this recurring task" checkbox
   - Enter hours and complete

### Testing Start/End Dates:

1. **Create a recurring task with dates**:
   - Go to Quick Actions → Recurring
   - Set a "Start Date" (e.g., tomorrow)
   - Set an "End Date" (e.g., next month)
   - Save the task

2. **Verify behavior**:
   - Tasks won't generate before the start date
   - Tasks won't generate after the end date
   - The system respects these boundaries

### Testing Mobile Responsiveness:

1. **Resize your browser** to mobile width (or use DevTools device emulation)
2. **Navigate to**:
   - Client Dashboard
   - Public Monthly Report
3. **Verify**: The "Service Type Breakdown" section displays properly on mobile

## Troubleshooting

### Problem: "I don't see the new fields"
**Solution**: Run `npm run migrate` to add the database columns

### Problem: "Recurring tasks aren't showing up"
**Solution**:
1. Open the Recurring Tasks modal (Quick Actions → Recurring)
2. The modal automatically generates overdue tasks when opened
3. Check that your recurring task's "next due" date is today or earlier

### Problem: "Changes not visible after migration"
**Solution**:
1. Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)
2. Restart the dev server
3. Clear browser cache if needed

## Database Schema Changes

### New Columns in `tasks` table:
```sql
accepted BOOLEAN DEFAULT 0
accepted_at DATETIME
```

### New Column in `recurring_tasks` table:
```sql
recurring_start_date DATE
```

## Important Notes

- **Existing tasks**: All existing tasks will have `accepted = false` by default
- **Recurring task generation**: Still requires opening the Recurring Tasks modal
- **Future enhancement**: Could be automated with a background job
