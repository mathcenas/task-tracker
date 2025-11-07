import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const { verbose } = sqlite3;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.NODE_ENV === 'production'
  ? '/app/data/tasktracker.db'
  : path.join(__dirname, 'tasktracker.db');

console.log('🔍 Verifying task status consistency...');
console.log('📁 Database path:', dbPath);

const db = new (verbose().Database)(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
  console.log('✅ Connected to database\n');
});

db.serialize(() => {
  // Check finished tasks by status
  console.log('📊 FINISHED TASKS (finished=1) BY STATUS:');
  db.all(`
    SELECT status, COUNT(*) as count
    FROM tasks
    WHERE finished = 1
    GROUP BY status
    ORDER BY count DESC
  `, [], (err, rows) => {
    if (err) {
      console.error('❌ Error:', err);
      db.close();
      process.exit(1);
    }

    if (rows.length === 0) {
      console.log('  No finished tasks found\n');
    } else {
      rows.forEach(row => {
        const warning = row.status !== 'completed' ? ' ⚠️  NEEDS FIX' : ' ✅';
        console.log(`  ${row.status || 'NULL'}: ${row.count}${warning}`);
      });
      console.log('');
    }

    // Check tasks with hours but not finished
    console.log('📊 TASKS WITH HOURS BUT NOT FINISHED:');
    db.all(`
      SELECT id, description, hours, status, finished, type
      FROM tasks
      WHERE hours IS NOT NULL AND hours > 0 AND type != 'insumos' AND (finished = 0 OR finished IS NULL)
      LIMIT 10
    `, [], (err, tasks) => {
      if (err) {
        console.error('❌ Error:', err);
        db.close();
        process.exit(1);
      }

      if (tasks.length === 0) {
        console.log('  No tasks with hours but not finished ✅\n');
      } else {
        console.log(`  Found ${tasks.length} tasks (showing up to 10):`);
        tasks.forEach(task => {
          console.log(`  - ${task.description} | ${task.hours}h | Status: ${task.status} | Finished: ${task.finished} ⚠️`);
        });
        console.log('');
      }

      // Check insumos tasks status
      console.log('📊 INSUMOS TASKS BY STATUS:');
      db.all(`
        SELECT status, finished, COUNT(*) as count
        FROM tasks
        WHERE type = 'insumos'
        GROUP BY status, finished
        ORDER BY count DESC
      `, [], (err, rows) => {
        if (err) {
          console.error('❌ Error:', err);
          db.close();
          process.exit(1);
        }

        if (rows.length === 0) {
          console.log('  No insumos tasks found\n');
        } else {
          rows.forEach(row => {
            const warning = row.finished === 1 && row.status !== 'completed' ? ' ⚠️  NEEDS FIX' : '';
            console.log(`  Status: ${row.status || 'NULL'} | Finished: ${row.finished} | Count: ${row.count}${warning}`);
          });
          console.log('');
        }

        // Overall summary
        console.log('📊 OVERALL TASK SUMMARY:');
        db.get(`
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN finished = 1 THEN 1 ELSE 0 END) as finished_count,
            SUM(CASE WHEN finished = 1 AND status = 'completed' THEN 1 ELSE 0 END) as correctly_completed,
            SUM(CASE WHEN finished = 1 AND status != 'completed' THEN 1 ELSE 0 END) as incorrectly_completed,
            SUM(CASE WHEN hours > 0 AND type != 'insumos' AND (finished = 0 OR finished IS NULL) THEN 1 ELSE 0 END) as has_hours_not_finished
          FROM tasks
        `, [], (err, summary) => {
          if (err) {
            console.error('❌ Error:', err);
            db.close();
            process.exit(1);
          }

          console.log(`  Total tasks: ${summary.total}`);
          console.log(`  Finished tasks: ${summary.finished_count}`);
          console.log(`  Correctly completed (finished=1 + status='completed'): ${summary.correctly_completed} ✅`);
          console.log(`  Incorrectly completed (finished=1 but status≠'completed'): ${summary.incorrectly_completed}${summary.incorrectly_completed > 0 ? ' ⚠️' : ' ✅'}`);
          console.log(`  Tasks with hours but not finished: ${summary.has_hours_not_finished}${summary.has_hours_not_finished > 0 ? ' ⚠️' : ' ✅'}`);

          if (summary.incorrectly_completed > 0 || summary.has_hours_not_finished > 0) {
            console.log('\n⚠️  Issues found! Run: npm run fix:completed');
          } else {
            console.log('\n✨ All tasks have consistent status!');
          }

          db.close();
          process.exit(0);
        });
      });
    });
  });
});
