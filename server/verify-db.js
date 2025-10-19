import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const { verbose } = sqlite3;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.NODE_ENV === 'production'
  ? '/app/data/tasktracker.db'
  : path.join(__dirname, 'tasktracker.db');

console.log('🔍 Verifying database at:', dbPath);

const db = new (verbose().Database)(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }

  console.log('✅ Successfully opened database');

  // Check clients
  db.get('SELECT COUNT(*) as count FROM clients', (err, result) => {
    if (err) {
      console.error('❌ Error querying clients:', err);
    } else {
      console.log('📊 Clients in database:', result.count);
    }

    // Check tasks
    db.get('SELECT COUNT(*) as count FROM tasks', (err, result) => {
      if (err) {
        console.error('❌ Error querying tasks:', err);
      } else {
        console.log('📊 Tasks in database:', result.count);
      }

      // Check projects
      db.get('SELECT COUNT(*) as count FROM projects', (err, result) => {
        if (err) {
          console.error('❌ Error querying projects:', err);
        } else {
          console.log('📊 Projects in database:', result.count);
        }

        // Check users
        db.get('SELECT COUNT(*) as count FROM users', (err, result) => {
          if (err) {
            console.error('❌ Error querying users:', err);
          } else {
            console.log('📊 Users in database:', result.count);
          }

          // List all clients
          console.log('\n📋 All Clients:');
          db.all('SELECT id, name, slug, hourly_rate, created_at FROM clients ORDER BY created_at DESC', (err, rows) => {
            if (err) {
              console.error('❌ Error listing clients:', err);
            } else if (rows.length === 0) {
              console.log('   (No clients found)');
            } else {
              rows.forEach(row => {
                console.log(`   - ${row.name} (${row.slug}) - Rate: $${row.hourly_rate}/hr - Created: ${row.created_at}`);
              });
            }

            // List all tasks
            console.log('\n📋 All Tasks:');
            db.all('SELECT id, description, client_id, date, status, created_at FROM tasks ORDER BY created_at DESC LIMIT 10', (err, rows) => {
              if (err) {
                console.error('❌ Error listing tasks:', err);
              } else if (rows.length === 0) {
                console.log('   (No tasks found)');
              } else {
                rows.forEach(row => {
                  console.log(`   - ${row.description.substring(0, 50)} - Client: ${row.client_id} - Status: ${row.status} - Created: ${row.created_at}`);
                });
              }

              db.close();
              console.log('\n✅ Database verification complete');
            });
          });
        });
      });
    });
  });
});
