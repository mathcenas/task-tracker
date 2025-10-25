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

const today = new Date().toISOString().split('T')[0];

console.log('\n🔄 Setting all active recurring tasks to be due TODAY for testing...\n');
console.log(`Today's date: ${today}\n`);

// First show what will be updated
db.all(`SELECT id, name, next_due FROM recurring_tasks WHERE is_active = 1`, [], (err, rows) => {
  if (err) {
    console.error('Error querying tasks:', err);
    db.close();
    process.exit(1);
  }

  if (rows.length === 0) {
    console.log('❌ No active recurring tasks found!\n');
    db.close();
    process.exit(0);
  }

  console.log('📋 Active recurring tasks:\n');
  rows.forEach((row, index) => {
    console.log(`${index + 1}. ${row.name}`);
    console.log(`   Currently due: ${row.next_due} → Will change to: ${today}`);
    console.log('');
  });

  // Update all active recurring tasks to be due today
  db.run(`UPDATE recurring_tasks SET next_due = ? WHERE is_active = 1`, [today], function(err) {
    if (err) {
      console.error('❌ Error updating tasks:', err);
      db.close();
      process.exit(1);
    }

    console.log(`\n✅ Updated ${this.changes} recurring task(s) to be due today!`);
    console.log('\n📝 Next steps:');
    console.log('   1. Go to Weekly Dashboard');
    console.log('   2. Click "Quick Actions" → "Recurring"');
    console.log('   3. The modal will auto-generate the tasks');
    console.log('   4. Check your dashboards - they should appear now!\n');

    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      }
      process.exit(0);
    });
  });
});
