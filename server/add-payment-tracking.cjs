const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'tasktracker.db');
const db = new sqlite3.Database(dbPath);

console.log('Adding payment tracking columns to tasks table...');

db.serialize(() => {
  db.run(`
    ALTER TABLE tasks ADD COLUMN billed INTEGER DEFAULT 0
  `, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding billed column:', err);
    } else {
      console.log('✓ Added billed column');
    }
  });

  db.run(`
    ALTER TABLE tasks ADD COLUMN billedAt TEXT
  `, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding billedAt column:', err);
    } else {
      console.log('✓ Added billedAt column');
    }
  });

  db.run(`
    ALTER TABLE tasks ADD COLUMN paid INTEGER DEFAULT 0
  `, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding paid column:', err);
    } else {
      console.log('✓ Added paid column');
    }
  });

  db.run(`
    ALTER TABLE tasks ADD COLUMN paidAt TEXT
  `, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding paidAt column:', err);
    } else {
      console.log('✓ Added paidAt column');
    }
  });

  db.run(`
    ALTER TABLE tasks ADD COLUMN invoiceNumber TEXT
  `, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding invoiceNumber column:', err);
    } else {
      console.log('✓ Added invoiceNumber column');
    }
  });

  db.close(() => {
    console.log('✓ Payment tracking migration completed');
  });
});
