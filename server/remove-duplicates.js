import sqlite3 from 'sqlite3';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'tasktracker.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Finding duplicate tasks (smart matching)...\n');

// Get all tasks
const getAllTasksQuery = `SELECT id, date, description, cost, hours, created_at FROM tasks ORDER BY date DESC, created_at ASC`;

db.all(getAllTasksQuery, [], (err, tasks) => {
  if (err) {
    console.error('❌ Error fetching tasks:', err);
    db.close();
    return;
  }

  console.log(`📊 Analyzing ${tasks.length} tasks...\n`);

  // Normalize description by removing task type prefix and whitespace
  const normalizeDescription = (desc) => {
    // Remove common task type prefixes
    const prefixes = [
      'Gestión de\nServicios IT\n',
      'Gestión de Servicios IT\n',
      'Gestión de\nServicios IT',
      'Gestión de Servicios IT',
      'Incident\n',
      'Request\n',
      'Change\n',
      'Problem\n'
    ];

    let normalized = desc;
    for (const prefix of prefixes) {
      if (normalized.startsWith(prefix)) {
        normalized = normalized.substring(prefix.length);
        break;
      }
    }

    return normalized.trim().toLowerCase();
  };

  // Group tasks by date, normalized description, and cost
  const groups = new Map();

  tasks.forEach(task => {
    const normalizedDesc = normalizeDescription(task.description);
    const key = `${task.date}|${normalizedDesc}|${task.cost}|${task.hours}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(task);
  });

  // Find groups with duplicates
  const duplicateGroups = Array.from(groups.values()).filter(group => group.length > 1);

  if (duplicateGroups.length === 0) {
    console.log('✅ No duplicate tasks found!');
    db.close();
    return;
  }

  console.log(`📊 Found ${duplicateGroups.length} groups of duplicate tasks:\n`);

  let totalDuplicates = 0;
  const idsToDelete = [];

  duplicateGroups.forEach((group, index) => {
    console.log(`Group ${index + 1}:`);
    console.log(`  Date: ${group[0].date}`);
    console.log(`  Cost: $${group[0].cost}`);
    console.log(`  Hours: ${group[0].hours}`);
    console.log(`  Duplicates: ${group.length} copies`);
    console.log(`  Descriptions:`);

    group.forEach((task, i) => {
      const preview = task.description.replace(/\n/g, ' ').substring(0, 60);
      console.log(`    ${i + 1}. ${preview}${task.description.length > 60 ? '...' : ''}`);
    });

    // Keep the oldest one (first created), mark others for deletion
    const sortedByCreation = [...group].sort((a, b) =>
      new Date(a.created_at) - new Date(b.created_at)
    );

    console.log(`  Keeping: ID ${sortedByCreation[0].id} (created ${sortedByCreation[0].created_at})`);

    for (let i = 1; i < sortedByCreation.length; i++) {
      console.log(`  Will delete: ID ${sortedByCreation[i].id} (created ${sortedByCreation[i].created_at})`);
      idsToDelete.push(sortedByCreation[i].id);
      totalDuplicates++;
    }
    console.log('');
  });

  console.log(`\n📋 Summary:`);
  console.log(`  Total duplicate groups: ${duplicateGroups.length}`);
  console.log(`  Total tasks to delete: ${totalDuplicates}`);
  console.log(`  Tasks to keep: ${duplicateGroups.length}`);

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
