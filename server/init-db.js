import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';

const { verbose } = sqlite3;

// Ensure data directory exists
const dataDir = '/app/data';
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = '/app/data/tasktracker.db';
console.log('Initializing database at:', dbPath);

const db = new (verbose().Database)(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Initialize database tables
const initDB = async () => {
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      login_attempts INTEGER DEFAULT 0,
      locked_until DATETIME,
      is_active BOOLEAN DEFAULT 1
    )`,
    
    `CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      hourly_rate REAL NOT NULL DEFAULT 0,
      contact_person TEXT,
      email TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      start_date DATE,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients (id)
    )`,
    
    `CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      description TEXT NOT NULL,
      hours REAL,
      cost REAL,
      date DATE NOT NULL,
      type TEXT NOT NULL DEFAULT 'request',
      status TEXT NOT NULL DEFAULT 'pending',
      priority TEXT NOT NULL DEFAULT 'medium',
      finished BOOLEAN DEFAULT 0,
      notes TEXT,
      completed_at DATETIME,
      assigned_to TEXT,
      is_recurring BOOLEAN DEFAULT 0,
      recurring_day INTEGER,
      recurring_weekend BOOLEAN DEFAULT 0,
      recurring_weekend_type TEXT,
      recurring_weekend_day TEXT,
      recurring_end_date DATE,
      accepted BOOLEAN DEFAULT 0,
      accepted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients (id),
      FOREIGN KEY (project_id) REFERENCES projects (id)
    )`,
    
    `CREATE TABLE IF NOT EXISTS recurring_tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'request',
      priority TEXT NOT NULL DEFAULT 'medium',
      client_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      day_of_month INTEGER,
      estimated_hours REAL,
      estimated_cost REAL,
      is_active BOOLEAN DEFAULT 1,
      last_generated DATE,
      next_due DATE NOT NULL,
      recurring_start_date DATE,
      recurring_weekend BOOLEAN DEFAULT 0,
      recurring_weekend_type TEXT,
      recurring_weekend_day TEXT,
      recurring_end_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients (id),
      FOREIGN KEY (project_id) REFERENCES projects (id)
    )`,

    `CREATE TABLE IF NOT EXISTS task_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'request',
      priority TEXT NOT NULL DEFAULT 'medium',
      client_id TEXT,
      project_id TEXT,
      estimated_hours REAL,
      estimated_cost REAL,
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients (id),
      FOREIGN KEY (project_id) REFERENCES projects (id)
    )`
  ];

  for (const sql of tables) {
    await new Promise((resolve, reject) => {
      db.run(sql, (err) => {
        if (err) {
          console.error('Error creating table:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Migration: Add new columns to existing tables
  console.log('Running migrations...');

  const migrations = [
    // Add accepted and accepted_at to tasks table
    `ALTER TABLE tasks ADD COLUMN accepted BOOLEAN DEFAULT 0`,
    `ALTER TABLE tasks ADD COLUMN accepted_at DATETIME`,
    // Add recurring_start_date to recurring_tasks table
    `ALTER TABLE recurring_tasks ADD COLUMN recurring_start_date DATE`
  ];

  for (const migration of migrations) {
    await new Promise((resolve) => {
      db.run(migration, (err) => {
        if (err) {
          // Column might already exist, that's okay
          if (err.message.includes('duplicate column name')) {
            console.log('Column already exists, skipping migration');
          } else {
            console.log('Migration note:', err.message);
          }
        } else {
          console.log('Migration applied:', migration.substring(0, 50) + '...');
        }
        resolve();
      });
    });
  }

  console.log('Migrations complete');

  // Create default users with environment variable credentials
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPasswordPlain = process.env.ADMIN_PASSWORD || 'TaskTracker2025!';
  const userUsername = process.env.USER_USERNAME || 'user';
  const userPasswordPlain = process.env.USER_PASSWORD || 'User2025!';

  const adminPassword = bcrypt.hashSync(adminPasswordPlain, 10);
  const userPassword = bcrypt.hashSync(userPasswordPlain, 10);

  await new Promise((resolve, reject) => {
    db.run(`INSERT OR IGNORE INTO users (id, username, password_hash, email, role) VALUES
      ('admin-1', ?, ?, 'admin@tasktracker.pro', 'admin'),
      ('user-1', ?, ?, 'user@tasktracker.pro', 'user')`,
      [adminUsername, adminPassword, userUsername, userPassword],
      (err) => {
        if (err) {
          console.error('Error creating users:', err);
          reject(err);
        } else {
          console.log(`Default users created: ${adminUsername} (admin), ${userUsername} (user)`);
          resolve();
        }
      }
    );
  });

  console.log('Database initialization complete');
};

initDB().then(() => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
}).catch((err) => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});