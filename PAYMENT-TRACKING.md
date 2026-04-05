# Supplies Payment Tracking Guide

This guide explains how to use the new payment tracking feature for supplies.

## Overview

The payment tracking system helps you:
- Track which supplies have been billed/exported
- Monitor pending payments
- Never forget about outstanding invoices
- See which clients owe you money
- Keep payment history with dates

## Getting Started

### For Docker Users

If you're running TaskTracker in Docker, you need to run the migration first:

```bash
# Make the script executable (first time only)
chmod +x docker-run-payment-migration.sh

# Run the migration
./docker-run-payment-migration.sh
```

This will add the payment tracking columns to your database and restart the container.

### For Non-Docker Users

Run the migration script:

```bash
node server/add-payment-tracking.cjs
```

## How It Works

### 1. Supplies Page Enhancements

The Supplies page (`/supplies`) now includes:

- **Checkboxes** next to each supply item
- **Select All / Deselect All** button
- **Mark as Billed** button to mark selected supplies in bulk
- **Payment Tracker** button to navigate to the payment tracker

**Workflow:**
1. Filter supplies by client and time period
2. Export your report (CSV)
3. Select the supplies you've billed
4. Click "Mark as Billed"
5. Enter invoice number (optional)
6. Done! They're now tracked as pending payment

### 2. Payment Tracker Page

Access at: `/supplies/payments`

**Three Status Categories:**

1. **Not Billed** (Gray)
   - Supplies that haven't been exported/billed yet
   - Shows total unbilled amount

2. **Pending Payment** (Yellow/Red)
   - Billed supplies waiting for payment
   - Yellow: Recent (under 30 days)
   - Red: Overdue (30+ days)
   - Shows days overdue

3. **Paid** (Green)
   - Completed payments
   - Shows payment date

**Features:**

- **Statistics Dashboard**
  - Total unbilled amount
  - Total pending payment
  - Total paid

- **Filters**
  - Filter by client
  - Filter by status (all, unbilled, pending, paid)

- **Actions**
  - Mark as Billed (with invoice number)
  - Mark as Paid
  - Unmark Billed
  - Unmark Paid

## Complete Workflow Example

### Scenario: You purchased supplies for Client A

1. **Add Supply Entry**
   - Go to Add Task
   - Select Client A
   - Select Project
   - Type: Supplies (Insumos)
   - Add description and cost
   - Save

2. **Export Report**
   - Go to Supplies page
   - Filter by Client A
   - Export CSV
   - Send invoice to client

3. **Mark as Billed**
   - Select the supplies you exported
   - Click "Mark as Billed"
   - Enter invoice number: "INV-2024-001"
   - Confirm

4. **Monitor Payment**
   - Go to Payment Tracker (`/supplies/payments`)
   - See the supply in "Pending Payment" section
   - Check back periodically

5. **Record Payment**
   - When payment arrives
   - Click "Mark as Paid"
   - Done! It moves to "Paid" section

## Tips

- **Invoice Numbers**: Optional but recommended for better tracking
- **Overdue Alerts**: Items pending over 30 days are highlighted in red
- **Bulk Actions**: Select multiple supplies to mark as billed together
- **Payment History**: All dates are tracked (billed date, paid date)
- **Unmark Feature**: Made a mistake? You can unmark billed or paid status

## Database Fields

The following fields are now tracked for each task:

- `billed` - Boolean, whether the supply has been billed
- `billedAt` - Timestamp of when it was billed
- `paid` - Boolean, whether payment has been received
- `paidAt` - Timestamp of when payment was received
- `invoiceNumber` - Optional invoice/reference number

## Support

If you encounter any issues:

1. Check that the migration ran successfully
2. Restart your server/container
3. Check browser console for errors
4. Verify database has the new columns

## Future Enhancements

Potential features for future versions:
- Payment reminders/notifications
- Automatic payment tracking from accounting software
- Payment reports and analytics
- Client payment history dashboard
