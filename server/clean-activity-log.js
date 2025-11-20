import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const { verbose } = sqlite3;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.NODE_ENV === 'production'
  ? '/app/data/tasktracker.db'
  : path.join(__dirname, 'tasktracker.db');

const db = new (verbose().Database)(dbPath);

console.log('🧹 Cleaning old activity logs...');

// Keep only the last 1000 entries
db.run(`DELETE FROM activity_log WHERE id NOT IN (
  SELECT id FROM activity_log ORDER BY timestamp DESC LIMIT 1000
)`, function(err) {
  if (err) {
    console.error('❌ Error cleaning activity log:', err);
  } else {
    console.log(`✅ Deleted ${this.changes} old activity log entries`);
  }

  // Vacuum to reclaim space
  db.run('VACUUM', (err) => {
    if (err) {
      console.error('❌ Error vacuuming database:', err);
    } else {
      console.log('✅ Database vacuumed successfully');
    }
    db.close();
  });
});
