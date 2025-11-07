import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const { verbose } = sqlite3;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.NODE_ENV === 'production'
  ? '/app/data/tasktracker.db'
  : path.join(__dirname, 'tasktracker.db');

console.log('🔧 Fixing completed tasks status...');
console.log('📁 Database path:', dbPath);

const db = new (verbose().Database)(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
  console.log('✅ Connected to database');
});

db.serialize(() => {
  // Fix tasks that are marked as finished=1 but have wrong status
  console.log('\n📊 Finding tasks that need fixing...');

  db.all(`
    SELECT id, description, finished, status, hours, cost, type
    FROM tasks
    WHERE finished = 1 AND status != 'completed'
  `, [], (err, tasks) => {
    if (err) {
      console.error('❌ Error querying tasks:', err);
      db.close();
      process.exit(1);
    }

    if (tasks.length === 0) {
      console.log('✅ No tasks need fixing - all completed tasks have correct status');
      db.close();
      process.exit(0);
    }

    console.log(`\n🔍 Found ${tasks.length} tasks with finished=1 but wrong status:`);
    tasks.forEach(task => {
      console.log(`  - [${task.type}] ${task.description} - Status: ${task.status} (should be completed)`);
    });

    console.log('\n🔄 Updating tasks...');

    db.run(`
      UPDATE tasks
      SET status = 'completed'
      WHERE finished = 1 AND status != 'completed'
    `, [], function(err) {
      if (err) {
        console.error('❌ Error updating tasks:', err);
        db.close();
        process.exit(1);
      }

      console.log(`✅ Updated ${this.changes} tasks to status='completed'`);

      // Also fix tasks that have hours but aren't marked as finished
      console.log('\n📊 Finding tasks with hours but not marked as finished...');

      db.all(`
        SELECT id, description, finished, status, hours, type
        FROM tasks
        WHERE hours IS NOT NULL AND hours > 0 AND (finished = 0 OR finished IS NULL)
      `, [], (err, unfinishedTasks) => {
        if (err) {
          console.error('❌ Error querying unfinished tasks:', err);
          db.close();
          process.exit(1);
        }

        if (unfinishedTasks.length === 0) {
          console.log('✅ No tasks with hours need fixing');
          console.log('\n✨ All fixes completed successfully!');
          db.close();
          process.exit(0);
        }

        console.log(`\n🔍 Found ${unfinishedTasks.length} tasks with hours but not finished:`);
        unfinishedTasks.forEach(task => {
          console.log(`  - [${task.type}] ${task.description} - ${task.hours}h (Status: ${task.status})`);
        });

        console.log('\n🔄 Updating these tasks to finished=1 and status=completed...');

        db.run(`
          UPDATE tasks
          SET finished = 1, status = 'completed', completed_at = datetime('now')
          WHERE hours IS NOT NULL AND hours > 0 AND (finished = 0 OR finished IS NULL)
        `, [], function(err) {
          if (err) {
            console.error('❌ Error updating unfinished tasks:', err);
            db.close();
            process.exit(1);
          }

          console.log(`✅ Updated ${this.changes} tasks to finished=1 and status='completed'`);
          console.log('\n✨ All fixes completed successfully!');

          db.close();
          process.exit(0);
        });
      });
    });
  });
});
