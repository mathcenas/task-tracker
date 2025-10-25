import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const { verbose } = sqlite3;

// Check for data directory
let dataDir = './data';
let dbPath = './data/tasktracker.db';

// Check if running in Docker
if (fs.existsSync('/app/data')) {
  dataDir = '/app/data';
  dbPath = '/app/data/tasktracker.db';
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
