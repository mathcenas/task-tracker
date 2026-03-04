# Client Yearly Rates Feature

## Overview

The Yearly Rates feature allows you to set different hourly rates for each client based on the year. This ensures that when you export reports for tasks from different years, the correct historical hourly rate is used for cost calculations.

## How It Works

### 1. Managing Yearly Rates

- Go to the **Clients** page
- Find the client you want to manage
- Click the **"Yearly Rates"** button (blue button with calendar icon)
- A modal will open showing:
  - Current default hourly rate
  - List of configured yearly rates
  - Form to add new yearly rates

### 2. Adding a Yearly Rate

1. In the Yearly Rates modal, enter:
   - **Year**: The year for which this rate applies (e.g., 2024)
   - **Hourly Rate**: The rate for that year (e.g., 75.00)
2. Click **"Add"**
3. The rate will be saved and displayed in the list

### 3. How Rates are Applied

When you export reports (monthly, multi-month, or by project):
- The system automatically uses the correct yearly rate based on the task date
- If no specific rate exists for a year, it falls back to the client's default rate
- Multi-month reports spanning multiple years will show all applicable rates

**Example:**
- Client has default rate: $70/hour
- 2023 rate: $65/hour
- 2024 rate: $75/hour
- 2025 rate: $80/hour

When exporting tasks from 2022-2024:
- 2022 tasks: $70/hour (default)
- 2023 tasks: $65/hour (specific rate)
- 2024 tasks: $75/hour (specific rate)

### 4. Multi-Month Reports

When generating multi-month reports that span different years:
- The report header will show all applicable rates
- Each task line item will be calculated using its year's rate
- Totals will accurately reflect the different rates used

**Example Report Header:**
```
Service Rate(s): 2023: $65.00/hour, 2024: $75.00/hour, 2025: $80.00/hour
```

## Database Migration

### Initial Setup

Run this command to migrate existing client rates to the current year:

```bash
npm run migrate:yearly-rates
```

This will:
- Create the `client_yearly_rates` table
- Copy all existing client hourly rates to the current year
- Ensure historical data integrity

### Database Structure

**client_yearly_rates table:**
- `id`: Unique identifier
- `client_id`: Reference to the client
- `year`: The year this rate applies to
- `hourly_rate`: The hourly rate for that year
- `created_at`: When the rate was created
- `updated_at`: When the rate was last updated

## API Endpoints

### Get Client Yearly Rates
```
GET /api/clients/:clientId/yearly-rates
```

### Save/Update Yearly Rate
```
POST /api/clients/:clientId/yearly-rates
Body: { id, year, hourlyRate }
```

### Delete Yearly Rate
```
DELETE /api/clients/:clientId/yearly-rates/:rateId
```

## Best Practices

1. **Set rates at year-end**: When negotiating new rates, add them for the upcoming year
2. **Keep historical rates**: Don't delete old rates - they're needed for accurate historical reports
3. **Review annually**: Check and update rates at the start of each year
4. **Document changes**: Use the activity log to track rate changes

## Benefits

- **Accurate Historical Reports**: Export correct costs for tasks from any time period
- **Easy Rate Management**: Centralized location to view and manage all yearly rates
- **Automatic Calculation**: System automatically uses the correct rate based on task date
- **Audit Trail**: All rates are preserved for historical accuracy
- **Future Planning**: Set rates for upcoming years in advance
