import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';

const { verbose } = sqlite3;

const dbPath = '/app/data/tasktracker.db';
const backupDir = '/app/data/backups';

// Ensure backup directory exists
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const db = new (verbose().Database)(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
});

const createBackup = () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupFileName = `backup-${timestamp}.json`;
  const backupPath = path.join(backupDir, backupFileName);

  console.log(`📦 Creating backup: ${backupFileName}`);

  const backup = {
    exportDate: new Date().toISOString(),
    version: '1.0',
    data: {}
  };

  // Export clients
  db.all('SELECT * FROM clients', (err, clients) => {
    if (err) {
      console.error('❌ Error exporting clients:', err);
      db.close();
      process.exit(1);
    }
    backup.data.clients = clients;

    // Export projects
    db.all('SELECT * FROM projects', (err, projects) => {
      if (err) {
        console.error('❌ Error exporting projects:', err);
        db.close();
        process.exit(1);
      }
      backup.data.projects = projects;

      // Export tasks
      db.all('SELECT * FROM tasks', (err, tasks) => {
        if (err) {
          console.error('❌ Error exporting tasks:', err);
          db.close();
          process.exit(1);
        }
        backup.data.tasks = tasks;

        // Export recurring tasks
        db.all('SELECT * FROM recurring_tasks', (err, recurringTasks) => {
          if (err) {
            console.error('❌ Error exporting recurring tasks:', err);
            db.close();
            process.exit(1);
          }
          backup.data.recurringTasks = recurringTasks;

          // Export task templates
          db.all('SELECT * FROM task_templates', (err, taskTemplates) => {
            if (err) {
              console.error('❌ Error exporting task templates:', err);
              db.close();
              process.exit(1);
            }
            backup.data.taskTemplates = taskTemplates;

            // Write backup to file
            try {
              fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
              console.log('✅ Backup created successfully:', {
                file: backupFileName,
                path: backupPath,
                clients: clients.length,
                projects: projects.length,
                tasks: tasks.length,
                recurringTasks: recurringTasks.length,
                taskTemplates: taskTemplates.length
            });

            // Clean old backups (keep last 30 days)
            cleanOldBackups();

            db.close();
            process.exit(0);
          } catch (writeErr) {
            console.error('❌ Error writing backup file:', writeErr);
            db.close();
            process.exit(1);
          }
          });
        });
      });
    });
  });
};

const cleanOldBackups = () => {
  const files = fs.readdirSync(backupDir);
  const backupFiles = files
    .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
    .map(f => ({
      name: f,
      path: path.join(backupDir, f),
      time: fs.statSync(path.join(backupDir, f)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);

  // Keep last 30 backups
  const toDelete = backupFiles.slice(30);

  toDelete.forEach(file => {
    try {
      fs.unlinkSync(file.path);
      console.log(`🗑️  Deleted old backup: ${file.name}`);
    } catch (err) {
      console.error(`❌ Error deleting backup ${file.name}:`, err);
    }
  });
};

createBackup();
