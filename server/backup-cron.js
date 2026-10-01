import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildFullBackup } from './backup-tables.js';

const { verbose } = sqlite3;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.NODE_ENV === 'production' ? '/app/data/tasktracker.db' : path.join(__dirname, 'tasktracker.db');
const backupDir = process.env.NODE_ENV === 'production' ? '/app/data/backups' : path.join(__dirname, 'backups');

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const statusPath = path.join(backupDir, 'last-status.json');

// Written after every run (success or failure) so the admin panel can show
// whether the automatic backup is actually working, instead of that only
// being visible as console output inside the container.
const writeStatus = (status) => {
  try {
    fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
  } catch (err) {
    console.error('❌ Error writing backup status file:', err);
  }
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

  // Keep last 7 backups
  const toDelete = backupFiles.slice(7);

  toDelete.forEach(file => {
    try {
      fs.unlinkSync(file.path);
      console.log(`🗑️  Deleted old backup: ${file.name}`);
    } catch (err) {
      console.error(`❌ Error deleting backup ${file.name}:`, err);
    }
  });
};

async function main() {
  const db = new (verbose().Database)(dbPath, (err) => {
    if (err) {
      console.error('❌ Error opening database:', err);
      writeStatus({ success: false, timestamp: new Date().toISOString(), error: err.message });
      process.exit(1);
    }
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupFileName = `backup-${timestamp}.json`;
  const backupPath = path.join(backupDir, backupFileName);

  console.log(`📦 Creating backup: ${backupFileName}`);

  try {
    const backup = await buildFullBackup(db, 'cron');
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    console.log('✅ Backup created successfully:', { file: backupFileName, path: backupPath, ...backup.metadata.counts, totalRecords: backup.metadata.totalRecords });
    writeStatus({
      success: true,
      timestamp: new Date().toISOString(),
      file: backupFileName,
      totalRecords: backup.metadata.totalRecords,
      counts: backup.metadata.counts,
    });
    cleanOldBackups();
    db.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error creating backup:', err);
    writeStatus({
      success: false,
      timestamp: new Date().toISOString(),
      error: err.message,
    });
    db.close();
    process.exit(1);
  }
}

main();
