import sqlite3 from 'sqlite3';
import fs from 'fs';

const { verbose } = sqlite3;

let dbPath = './server/tasktracker.db';

if (fs.existsSync('/app/data')) {
  dbPath = '/app/data/tasktracker.db';
} else if (fs.existsSync('./data/tasktracker.db')) {
  dbPath = './data/tasktracker.db';
}

console.log('Using database at:', dbPath);

if (!fs.existsSync(dbPath)) {
  console.error('Database not found!');
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

const migrateYearlyRates = async () => {
  console.log('\n🔄 Starting yearly rates migration...\n');

  try {
    await new Promise((resolve, reject) => {
      db.run(`CREATE TABLE IF NOT EXISTS client_yearly_rates (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        year INTEGER NOT NULL,
        hourly_rate REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE,
        UNIQUE(client_id, year)
      )`, (err) => {
        if (err) reject(err);
        else {
          console.log('✓ client_yearly_rates table created/verified');
          resolve();
        }
      });
    });

    await new Promise((resolve, reject) => {
      const currentYear = new Date().getFullYear();
      db.run(`INSERT OR IGNORE INTO client_yearly_rates (id, client_id, year, hourly_rate)
              SELECT
                'rate-' || clients.id || '-' || ?,
                clients.id,
                ?,
                clients.hourly_rate
              FROM clients
              WHERE clients.hourly_rate > 0`,
        [currentYear, currentYear],
        (err) => {
          if (err) reject(err);
          else {
            console.log(`✓ Migrated existing client rates to ${currentYear}`);
            resolve();
          }
        }
      );
    });

    db.all('SELECT * FROM client_yearly_rates ORDER BY client_id, year', (err, rates) => {
      if (err) {
        console.error('Error reading rates:', err);
      } else {
        console.log(`\n✅ Migration complete! Total yearly rates: ${rates.length}\n`);
        if (rates.length > 0) {
          console.log('Sample rates:');
          rates.slice(0, 5).forEach(rate => {
            console.log(`  - Client ${rate.client_id}: ${rate.year} → $${rate.hourly_rate}/hour`);
          });
        }
      }

      db.close(() => {
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    db.close(() => {
      process.exit(1);
    });
  }
};

migrateYearlyRates();
