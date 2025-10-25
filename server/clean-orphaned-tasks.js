import sqlite3 from 'sqlite3';
import fs from 'fs';

const { verbose } = sqlite3;

// Check for data directory
let dbPath = './data/tasktracker.db';

// Check if running in Docker
if (fs.existsSync('/app/data')) {
  dbPath = '/app/data/tasktracker.db';
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
  }
});

console.log('\n🔍 Looking for orphaned tasks (tasks with empty client_id or project_id)...\n');

// First, let's see what we're dealing with
db.all(`SELECT id, description, client_id, project_id, date FROM tasks WHERE client_id = '' OR project_id = ''`, [], (err, rows) => {
  if (err) {
    console.error('Error querying tasks:', err);
    db.close();
    process.exit(1);
  }

  if (rows.length === 0) {
    console.log('✅ No orphaned tasks found!\n');
    db.close();
    process.exit(0);
  }

  console.log(`Found ${rows.length} orphaned task(s):\n`);
  rows.forEach((row, index) => {
    console.log(`${index + 1}. ${row.description}`);
    console.log(`   ID: ${row.id}`);
    console.log(`   Date: ${row.date}`);
    console.log(`   Client ID: "${row.client_id}" | Project ID: "${row.project_id}"`);
    console.log('');
  });

  // Delete them
  db.run(`DELETE FROM tasks WHERE client_id = '' OR project_id = ''`, [], function(err) {
    if (err) {
      console.error('❌ Error deleting tasks:', err);
      db.close();
      process.exit(1);
    }

    console.log(`\n✅ Deleted ${this.changes} orphaned task(s)\n`);

    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      }
      process.exit(0);
    });
  });
});
