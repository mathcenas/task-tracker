import sqlite3 from 'sqlite3';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'tasktracker.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Finding duplicate tasks...\n');

const findDuplicatesQuery = `
  SELECT
    date,
    description,
    cost,
    COUNT(*) as count,
    GROUP_CONCAT(id) as ids,
    GROUP_CONCAT(created_at) as created_dates
  FROM tasks
  GROUP BY date, description, cost
  HAVING count > 1
  ORDER BY count DESC, date DESC
`;

db.all(findDuplicatesQuery, [], (err, duplicates) => {
  if (err) {
    console.error('❌ Error finding duplicates:', err);
    db.close();
    return;
  }

  if (duplicates.length === 0) {
    console.log('✅ No duplicate tasks found!');
    db.close();
    return;
  }

  console.log(`📊 Found ${duplicates.length} groups of duplicate tasks:\n`);

  let totalDuplicates = 0;
  const idsToDelete = [];

  duplicates.forEach((group, index) => {
    const ids = group.ids.split(',');
    const dates = group.created_at.split(',');

    console.log(`Group ${index + 1}:`);
    console.log(`  Date: ${group.date}`);
    console.log(`  Description: ${group.description.substring(0, 50)}${group.description.length > 50 ? '...' : ''}`);
    console.log(`  Cost: $${group.cost}`);
    console.log(`  Duplicates: ${group.count} copies`);

    const tasksByDate = ids.map((id, i) => ({
      id,
      created_at: dates[i]
    })).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    console.log(`  Keeping: ${tasksByDate[0].id} (created ${tasksByDate[0].created_at})`);

    for (let i = 1; i < tasksByDate.length; i++) {
      console.log(`  Will delete: ${tasksByDate[i].id} (created ${tasksByDate[i].created_at})`);
      idsToDelete.push(tasksByDate[i].id);
      totalDuplicates++;
    }
    console.log('');
  });

  console.log(`\n📋 Summary:`);
  console.log(`  Total duplicate groups: ${duplicates.length}`);
  console.log(`  Total tasks to delete: ${totalDuplicates}`);
  console.log(`  Tasks to keep: ${duplicates.length}`);

  if (idsToDelete.length === 0) {
    console.log('\n✅ Nothing to delete!');
    db.close();
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('\n⚠️  Do you want to delete these duplicate tasks? (yes/no): ', (answer) => {
    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
      console.log('\n🗑️  Deleting duplicates...');

      const placeholders = idsToDelete.map(() => '?').join(',');
      const deleteQuery = `DELETE FROM tasks WHERE id IN (${placeholders})`;

      db.run(deleteQuery, idsToDelete, function(err) {
        if (err) {
          console.error('❌ Error deleting duplicates:', err);
        } else {
          console.log(`✅ Successfully deleted ${this.changes} duplicate tasks!`);
        }

        rl.close();
        db.close();
      });
    } else {
      console.log('\n❌ Deletion cancelled.');
      rl.close();
      db.close();
    }
  });
});
