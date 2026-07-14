import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const { verbose } = sqlite3;

// Check for data directory
let dataDir = './server';
let dbPath = './server/tasktracker.db';

// Check if running in Docker
if (fs.existsSync('/app/data')) {
  dataDir = '/app/data';
  dbPath = '/app/data/tasktracker.db';
} else if (fs.existsSync('./data/tasktracker.db')) {
  dataDir = './data';
  dbPath = './data/tasktracker.db';
}

console.log('Using database at:', dbPath);

if (!fs.existsSync(dbPath)) {
  console.error('Database not found! Please run the server first to create the database.');
  process.exit(1);
}

const db = new (verbose().Database)(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  } else {
    console.log('Connected to SQLite database');
  }
});

const runMigrations = async () => {
  console.log('Running migrations...');

  const migrations = [
    {
      name: 'Add accepted fields to tasks',
      sql: `ALTER TABLE tasks ADD COLUMN accepted BOOLEAN DEFAULT 0`
    },
    {
      name: 'Add accepted_at to tasks',
      sql: `ALTER TABLE tasks ADD COLUMN accepted_at DATETIME`
    },
    {
      name: 'Add recurring_start_date to recurring_tasks',
      sql: `ALTER TABLE recurring_tasks ADD COLUMN recurring_start_date DATE`
    },
    {
      name: 'Update status: pending to not_started',
      sql: `UPDATE tasks SET status = 'not_started' WHERE status = 'pending'`
    },
    {
      name: 'Update status: in-progress to in_progress',
      sql: `UPDATE tasks SET status = 'in_progress' WHERE status = 'in-progress'`
    },
    {
      name: 'Update status: cancelled to completed',
      sql: `UPDATE tasks SET status = 'completed' WHERE status = 'cancelled'`
    },
    {
      name: 'Add quote_type to quotes',
      sql: `ALTER TABLE quotes ADD COLUMN quote_type TEXT DEFAULT 'standard'`
    },
    {
      name: 'Create monitor_feeds table',
      sql: `CREATE TABLE IF NOT EXISTS monitor_feeds (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        client_id TEXT,
        project_id TEXT,
        enabled INTEGER DEFAULT 1,
        last_checked DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
      )`
    },
    {
      name: 'Create client_yearly_rates table',
      sql: `CREATE TABLE IF NOT EXISTS client_yearly_rates (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        year INTEGER NOT NULL,
        hourly_rate REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
        UNIQUE(client_id, year)
      )`
    },
    {
      name: 'Migrate existing hourly rates to yearly rates',
      sql: `INSERT OR IGNORE INTO client_yearly_rates (id, client_id, year, hourly_rate)
            SELECT
              'rate-' || clients.id || '-' || strftime('%Y', 'now'),
              clients.id,
              CAST(strftime('%Y', 'now') AS INTEGER),
              clients.hourly_rate
            FROM clients
            WHERE clients.hourly_rate > 0`
    },
    {
      name: 'Create onboarding_requests table',
      sql: `CREATE TABLE IF NOT EXISTS onboarding_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        manager_email TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('alta', 'baja')),
        employee_name TEXT NOT NULL,
        role TEXT,
        effective_date TEXT,
        details TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    }
  ];

  for (const migration of migrations) {
    await new Promise((resolve) => {
      db.run(migration.sql, (err) => {
        if (err) {
          if (err.message.includes('duplicate column name')) {
            console.log(`✓ ${migration.name} - Already applied`);
          } else {
            console.error(`✗ ${migration.name} - Error:`, err.message);
          }
        } else {
          console.log(`✓ ${migration.name} - Applied successfully`);
        }
        resolve();
      });
    });
  }

  console.log('\n✅ All migrations completed!\n');

  // Close the database
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    }
    process.exit(0);
  });
};

runMigrations().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
