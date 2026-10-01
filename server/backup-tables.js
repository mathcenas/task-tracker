// Shared source of truth for what a full system backup/restore covers, plus
// the generic (schema-agnostic) logic to build and apply one. Previously
// server/index.js's /api/backup + /api/restore and server/backup-cron.js
// each hand-wrote their own column lists for a handful of tables, which is
// exactly the kind of duplication that drifts out of sync as the schema
// grows. Building the INSERT from each row's own keys means new columns -
// and new tables added to BACKUP_TABLES - are picked up automatically.
//
// Deliberately excludes `users`: those two accounts are reprovisioned from
// ADMIN_USERNAME/ADMIN_PASSWORD/USER_USERNAME/USER_PASSWORD on every server
// boot (see runMigrations/db.run('INSERT OR IGNORE INTO users...') in
// server/index.js), so they're environment config, not data to restore -
// and a backup file is a worse place for password hashes to live than it
// needs to be.
export const BACKUP_TABLES = [
  'clients',
  'client_yearly_rates',
  'projects',
  'tasks',
  'recurring_tasks',
  'task_templates',
  'task_notes',
  'notes',
  'company_settings',
  'quotes',
  'quote_items',
  'onboarding_requests',
  'onboarding_updates',
  'status_pages',
  'monitor_mappings',
  'monitor_feeds',
  'uptime_kuma_config',
  'activity_logs',
];

// Backups made before this list grew used these camelCase keys for a
// handful of tables instead of the literal table name. Restore still
// accepts them so older backup files keep working.
const LEGACY_KEY_ALIASES = {
  recurring_tasks: 'recurringTasks',
  task_templates: 'taskTemplates',
};

function dbAll(db, sql) {
  return new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      err ? reject(err) : resolve(this);
    });
  });
}

export async function buildFullBackup(db, exportedBy) {
  const data = {};
  const counts = {};
  let totalRecords = 0;

  for (const table of BACKUP_TABLES) {
    const rows = await dbAll(db, `SELECT * FROM ${table}`);
    data[table] = rows;
    counts[table] = rows.length;
    totalRecords += rows.length;
  }

  return {
    exportDate: new Date().toISOString(),
    version: '3.0',
    exportedBy: exportedBy || 'system',
    metadata: { totalRecords, counts },
    data,
  };
}

// Clears and re-populates every table in BACKUP_TABLES from `data`. Returns
// a { tableName: rowsInserted } summary. Rows that fail to insert (e.g. a
// stale foreign key) are logged and skipped rather than aborting the whole
// restore.
export async function restoreFullBackup(db, data) {
  const summary = {};

  // Older backup files predate some tables and simply don't have a key for
  // them. Only touch a table if the uploaded file actually says something
  // about it (even an empty array) — otherwise an old backup would wipe out
  // newer data (company_settings, quotes, etc.) it never knew to restore.
  const presentTables = BACKUP_TABLES.filter((table) => {
    const alias = LEGACY_KEY_ALIASES[table];
    return data[table] !== undefined || (alias && data[alias] !== undefined);
  });

  // Delete children before parents so nothing references a row that's
  // already gone mid-restore (this app doesn't enforce foreign keys, but
  // there's no reason to rely on that).
  for (const table of [...presentTables].reverse()) {
    await dbRun(db, `DELETE FROM ${table}`);
  }

  for (const table of presentTables) {
    const alias = LEGACY_KEY_ALIASES[table];
    const rows = data[table] || (alias ? data[alias] : undefined) || [];
    let inserted = 0;

    for (const row of rows) {
      // Backward compatibility: very old backups used the pre-rename task
      // status values.
      if (table === 'tasks' && row.status) {
        if (row.status === 'pending') row.status = 'not_started';
        else if (row.status === 'in-progress') row.status = 'in_progress';
        else if (row.status === 'cancelled') row.status = 'completed';
      }

      const columns = Object.keys(row);
      if (columns.length === 0) continue;
      const placeholders = columns.map(() => '?').join(', ');
      try {
        await dbRun(
          db,
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
          columns.map((c) => row[c])
        );
        inserted++;
      } catch (err) {
        console.error(`Error restoring a row into ${table}:`, err.message);
      }
    }
    summary[table] = inserted;
  }

  return summary;
}
