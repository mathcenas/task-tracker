import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const { verbose } = sqlite3;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.NODE_ENV === 'production'
  ? '/app/data/tasktracker.db'
  : path.join(__dirname, 'tasktracker.db');

const db = new (verbose().Database)(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  } else {
    console.log('✅ Connected to database at:', dbPath);
  }
});

// Check if status_pages table exists
db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='status_pages'", (err, row) => {
  if (err) {
    console.error('❌ Error checking table:', err);
    process.exit(1);
  }

  if (!row) {
    console.log('❌ status_pages table does not exist');
    console.log('📝 Creating status_pages table...');

    db.run(`CREATE TABLE IF NOT EXISTS status_pages (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      organization_name TEXT NOT NULL,
      description TEXT,
      enabled BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        console.error('❌ Error creating table:', err);
        process.exit(1);
      }
      console.log('✅ status_pages table created successfully');
      listStatusPages();
    });
  } else {
    console.log('✅ status_pages table exists');
    listStatusPages();
  }
});

function listStatusPages() {
  db.all('SELECT * FROM status_pages', (err, rows) => {
    if (err) {
      console.error('❌ Error fetching status pages:', err);
      process.exit(1);
    }

    console.log('\n📊 Current status pages:');
    if (rows.length === 0) {
      console.log('   No status pages found');
    } else {
      rows.forEach((row, idx) => {
        console.log(`\n   ${idx + 1}. ${row.organization_name}`);
        console.log(`      Slug: ${row.slug}`);
        console.log(`      URL: /status/${row.slug}`);
        console.log(`      Enabled: ${row.enabled ? 'Yes' : 'No'}`);
        console.log(`      Created: ${row.created_at}`);
      });
    }

    db.close(() => {
      console.log('\n✅ Database connection closed');
    });
  });
}
