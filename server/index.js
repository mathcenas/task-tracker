import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import UptimeKumaService from './uptime-kuma-service.js';

const { verbose } = sqlite3;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Database setup
const dbPath = process.env.NODE_ENV === 'production' 
  ? '/app/data/tasktracker.db' 
  : path.join(__dirname, 'tasktracker.db');

const db = new (verbose().Database)(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
  } else {
    console.log('✅ Connected to SQLite database at:', dbPath);
    console.log('📁 Database file exists:', fs.existsSync(dbPath));
  }
});

// Initialize database tables
const initDB = () => {
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      login_attempts INTEGER DEFAULT 0,
      locked_until DATETIME,
      is_active BOOLEAN DEFAULT 1
    )`,
    
    `CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      hourly_rate REAL NOT NULL DEFAULT 0,
      contact_person TEXT,
      email TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      start_date DATE,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients (id)
    )`,
    
    `CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      description TEXT NOT NULL,
      hours REAL,
      cost REAL,
      date DATE NOT NULL,
      type TEXT NOT NULL DEFAULT 'request',
      status TEXT NOT NULL DEFAULT 'in_progress',
      priority TEXT NOT NULL DEFAULT 'medium',
      finished BOOLEAN DEFAULT 0,
      notes TEXT,
      completed_at DATETIME,
      assigned_to TEXT,
      is_recurring BOOLEAN DEFAULT 0,
      recurring_day INTEGER,
      recurring_weekend BOOLEAN DEFAULT 0,
      recurring_weekend_type TEXT,
      recurring_weekend_day TEXT,
      recurring_end_date DATE,
      billed BOOLEAN DEFAULT 0,
      billedAt DATETIME,
      paid BOOLEAN DEFAULT 0,
      paidAt DATETIME,
      invoiceNumber TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients (id),
      FOREIGN KEY (project_id) REFERENCES projects (id)
    )`,

    `CREATE TABLE IF NOT EXISTS recurring_tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'request',
      priority TEXT NOT NULL DEFAULT 'medium',
      client_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      day_of_month INTEGER,
      estimated_hours REAL,
      estimated_cost REAL,
      is_active BOOLEAN DEFAULT 1,
      last_generated DATE,
      next_due DATE NOT NULL,
      recurring_weekend BOOLEAN DEFAULT 0,
      recurring_weekend_type TEXT,
      recurring_weekend_day TEXT,
      recurring_end_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients (id),
      FOREIGN KEY (project_id) REFERENCES projects (id)
    )`,

    `CREATE TABLE IF NOT EXISTS uptime_kuma_config (
      id INTEGER PRIMARY KEY DEFAULT 1,
      enabled BOOLEAN DEFAULT 0,
      url TEXT,
      username TEXT,
      password TEXT,
      create_tasks_on_down BOOLEAN DEFAULT 1,
      create_tasks_on_up BOOLEAN DEFAULT 0,
      auto_assign_client TEXT,
      auto_assign_project TEXT,
      min_downtime_seconds INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      entity_name TEXT,
      details TEXT,
      user_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )`,

    `CREATE TABLE IF NOT EXISTS status_pages (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      organization_name TEXT NOT NULL,
      description TEXT,
      enabled BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS monitor_mappings (
      monitor_id INTEGER PRIMARY KEY,
      client_id TEXT,
      project_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients (id),
      FOREIGN KEY (project_id) REFERENCES projects (id)
    )`,

    `CREATE TABLE IF NOT EXISTS company_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      company_name TEXT DEFAULT 'TaskTracker Pro',
      logo_url TEXT,
      address TEXT,
      phone TEXT,
      email TEXT,
      website TEXT,
      tax_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS quotes (
      id TEXT PRIMARY KEY,
      quote_number TEXT UNIQUE NOT NULL,
      client_id TEXT NOT NULL,
      title TEXT NOT NULL,
      date DATE NOT NULL,
      expiry_date DATE,
      status TEXT DEFAULT 'draft',
      notes TEXT,
      terms TEXT,
      subtotal REAL DEFAULT 0,
      tax_rate REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients (id)
    )`,

    `CREATE TABLE IF NOT EXISTS quote_items (
      id TEXT PRIMARY KEY,
      quote_id TEXT NOT NULL,
      description TEXT NOT NULL,
      quantity REAL DEFAULT 1,
      unit_price REAL DEFAULT 0,
      amount REAL DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (quote_id) REFERENCES quotes (id) ON DELETE CASCADE
    )`
  ];

  tables.forEach(sql => {
    db.run(sql, (err) => {
      if (err) console.error('Error creating table:', err);
    });
  });

  // Create default users with environment variable credentials
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPasswordPlain = process.env.ADMIN_PASSWORD || 'TaskTracker2025!';
  const userUsername = process.env.USER_USERNAME || 'user';
  const userPasswordPlain = process.env.USER_PASSWORD || 'User2025!';

  const adminPassword = bcrypt.hashSync(adminPasswordPlain, 10);
  const userPassword = bcrypt.hashSync(userPasswordPlain, 10);

  db.run(`INSERT OR IGNORE INTO users (id, username, password_hash, email, role) VALUES
    ('admin-1', ?, ?, 'admin@tasktracker.pro', 'admin'),
    ('user-1', ?, ?, 'user@tasktracker.pro', 'user')`,
    [adminUsername, adminPassword, userUsername, userPassword],
    (err) => {
      if (!err) {
        console.log(`Default users initialized: ${adminUsername} (admin), ${userUsername} (user)`);
      }
    });
};

initDB();

// Run migrations to add new columns to existing tables
const runMigrations = () => {
  const migrations = [
    `ALTER TABLE tasks ADD COLUMN billed BOOLEAN DEFAULT 0`,
    `ALTER TABLE tasks ADD COLUMN billedAt DATETIME`,
    `ALTER TABLE tasks ADD COLUMN paid BOOLEAN DEFAULT 0`,
    `ALTER TABLE tasks ADD COLUMN paidAt DATETIME`,
    `ALTER TABLE tasks ADD COLUMN invoiceNumber TEXT`,
    `ALTER TABLE tasks ADD COLUMN accepted BOOLEAN DEFAULT 0`,
    `ALTER TABLE tasks ADD COLUMN accepted_at DATETIME`,
    `ALTER TABLE recurring_tasks ADD COLUMN recurring_start_date DATE`,
    `ALTER TABLE quotes ADD COLUMN quote_type TEXT DEFAULT 'standard'`,
  ];

  migrations.forEach(sql => {
    db.run(sql, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Migration error:', err.message, 'SQL:', sql);
      }
    });
  });
};

runMigrations();

// Activity logging helper function
const logActivity = (action, entityType, entityId, entityName, details = null, userId = 'system') => {
  const id = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const detailsJson = details ? JSON.stringify(details) : null;

  db.run(
    `INSERT INTO activity_logs (id, action, entity_type, entity_id, entity_name, details, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, action, entityType, entityId, entityName, detailsJson, userId],
    (err) => {
      if (err) console.error('Error logging activity:', err);
    }
  );
};

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log('🔐 [Auth] Authenticating request:', {
    path: req.path,
    method: req.method,
    authHeader: authHeader ? 'present' : 'missing',
    token: token || 'NO TOKEN',
    expectedToken: 'demo-token'
  });

  if (!token) {
    console.error('❌ [Auth] No token provided');
    return res.status(401).json({ error: 'Access token required' });
  }

  // Simple token validation (in production, use JWT)
  if (token === 'demo-token') {
    console.log('✅ [Auth] Token valid, user authenticated');
    req.user = { id: 'admin-1', role: 'admin' };
    next();
  } else {
    console.error('❌ [Auth] Invalid token provided:', token);
    res.status(403).json({ error: 'Invalid token' });
  }
};

// Auth routes
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  db.get('SELECT * FROM users WHERE username = ? AND is_active = 1', [username], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    bcrypt.compare(password, user.password_hash, (err, isValid) => {
      if (err || !isValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Update last login
      db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        token: 'demo-token' // In production, generate proper JWT
      });
    });
  });
});

// Client routes
app.get('/api/clients', authenticateToken, (req, res) => {
  db.all('SELECT * FROM clients ORDER BY name', (err, clients) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    // Fetch yearly rates for each client
    const clientsWithRates = [];
    let processed = 0;

    if (clients.length === 0) {
      return res.json([]);
    }

    clients.forEach(client => {
      db.all('SELECT * FROM client_yearly_rates WHERE client_id = ? ORDER BY year DESC',
        [client.id],
        (err, rates) => {
          if (!err && rates) {
            client.yearly_rates = rates;
          }
          clientsWithRates.push(client);
          processed++;

          if (processed === clients.length) {
            res.json(clientsWithRates);
          }
        }
      );
    });
  });
});

app.post('/api/clients', authenticateToken, (req, res) => {
  const { id, name, slug, hourlyRate, contactPerson, email, phone } = req.body;

  console.log('📝 [API] Creating client with data:', { id, name, slug, hourlyRate, contactPerson, email, phone });

  // Validate required fields
  if (!id || !name || !slug) {
    console.error('❌ [API] Missing required fields:', { id, name, slug });
    return res.status(400).json({ error: 'Missing required fields: id, name, and slug are required' });
  }

  db.run(`INSERT INTO clients (id, name, slug, hourly_rate, contact_person, email, phone)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, name, slug, hourlyRate || 0, contactPerson || null, email || null, phone || null],
    function(err) {
      if (err) {
        console.error('❌ [API] Error creating client:', err);
        console.error('❌ [API] Error code:', err.code);
        console.error('❌ [API] Error message:', err.message);
        if (err.message.includes('UNIQUE constraint')) {
          return res.status(400).json({ error: 'Client with this name or slug already exists' });
        }
        return res.status(500).json({ error: 'Database error: ' + err.message });
      }
      console.log('✅ [API] Client created successfully with id:', id);

      // Log activity
      logActivity('created', 'client', id, name, { hourlyRate, email, phone }, req.user?.id);

      // Verify the client was saved by reading it back
      db.get('SELECT * FROM clients WHERE id = ?', [id], (err, client) => {
        if (err) {
          console.error('❌ [API] Error verifying client:', err);
        } else if (client) {
          console.log('✅ [API] Client verified in database:', client);
        } else {
          console.error('❌ [API] Client not found after insert!');
        }
      });

      res.json({ success: true, id });
    }
  );
});

app.put('/api/clients/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name, slug, hourlyRate, contactPerson, email, phone } = req.body;

  db.run(
    `UPDATE clients SET name = ?, slug = ?, hourly_rate = ?, contact_person = ?, email = ?, phone = ?
     WHERE id = ?`,
    [name, slug, hourlyRate, contactPerson, email, phone, id],
    function(err) {
      if (err) {
        console.error('Error updating client:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      // Log activity
      logActivity('updated', 'client', id, name, { hourlyRate, email, phone }, req.user?.id);
      res.json({ success: true });
    }
  );
});

app.delete('/api/clients/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  // Delete in correct order: tasks first, then projects, then client
  db.serialize(() => {
    db.run('DELETE FROM tasks WHERE client_id = ?', [id], function(err) {
      if (err) {
        console.error('Error deleting client tasks:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      db.run('DELETE FROM projects WHERE client_id = ?', [id], function(err) {
        if (err) {
          console.error('Error deleting client projects:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        db.run('DELETE FROM clients WHERE id = ?', [id], function(err) {
          if (err) {
            console.error('Error deleting client:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          console.log('✅ Client and related data deleted successfully:', id);
          res.json({ success: true });
        });
      });
    });
  });
});

// Client Yearly Rates routes
app.get('/api/clients/:clientId/yearly-rates', authenticateToken, (req, res) => {
  const { clientId } = req.params;

  db.all('SELECT * FROM client_yearly_rates WHERE client_id = ? ORDER BY year DESC',
    [clientId],
    (err, rates) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rates || []);
    }
  );
});

app.post('/api/clients/:clientId/yearly-rates', authenticateToken, (req, res) => {
  const { clientId } = req.params;
  const { id, year, hourlyRate } = req.body;

  if (!id || !year || hourlyRate === undefined) {
    return res.status(400).json({ error: 'Missing required fields: id, year, and hourlyRate' });
  }

  db.run(
    `INSERT INTO client_yearly_rates (id, client_id, year, hourly_rate)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(client_id, year) DO UPDATE SET hourly_rate = ?, updated_at = CURRENT_TIMESTAMP`,
    [id, clientId, year, hourlyRate, hourlyRate],
    function(err) {
      if (err) {
        console.error('Error saving yearly rate:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      // Log activity
      db.get('SELECT name FROM clients WHERE id = ?', [clientId], (err, client) => {
        if (client) {
          logActivity('updated', 'client_rate', clientId, client.name,
            { year, hourlyRate }, req.user?.id);
        }
      });

      res.json({ success: true, id });
    }
  );
});

app.delete('/api/clients/:clientId/yearly-rates/:rateId', authenticateToken, (req, res) => {
  const { rateId } = req.params;

  db.run('DELETE FROM client_yearly_rates WHERE id = ?', [rateId], function(err) {
    if (err) {
      console.error('Error deleting yearly rate:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ success: true });
  });
});

// Helper function to get hourly rate for a specific year
function getHourlyRateForYear(clientId, year, callback) {
  db.get(
    `SELECT hourly_rate FROM client_yearly_rates
     WHERE client_id = ? AND year = ?`,
    [clientId, year],
    (err, rate) => {
      if (err) {
        return callback(err, null);
      }

      if (rate) {
        return callback(null, rate.hourly_rate);
      }

      // Fallback to client's default rate
      db.get('SELECT hourly_rate FROM clients WHERE id = ?', [clientId], (err, client) => {
        if (err || !client) {
          return callback(err || new Error('Client not found'), null);
        }
        callback(null, client.hourly_rate);
      });
    }
  );
}

// Project routes
app.get('/api/projects', authenticateToken, (req, res) => {
  db.all('SELECT * FROM projects ORDER BY name', (err, projects) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(projects);
  });
});

app.post('/api/projects', authenticateToken, (req, res) => {
  const { id, clientId, name, description, startDate, status } = req.body;

  db.run(`INSERT INTO projects (id, client_id, name, description, start_date, status)
          VALUES (?, ?, ?, ?, ?, ?)`,
    [id, clientId, name, description, startDate, status],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ success: true, id });
    }
  );
});

app.put('/api/projects/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { clientId, name, description, startDate, status } = req.body;

  db.run(
    `UPDATE projects SET client_id = ?, name = ?, description = ?, start_date = ?, status = ?
     WHERE id = ?`,
    [clientId, name, description, startDate, status, id],
    function(err) {
      if (err) {
        console.error('Error updating project:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ success: true });
    }
  );
});

app.delete('/api/projects/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  // Delete tasks first, then project
  db.serialize(() => {
    db.run('DELETE FROM tasks WHERE project_id = ?', [id], function(err) {
      if (err) {
        console.error('Error deleting project tasks:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      db.run('DELETE FROM projects WHERE id = ?', [id], function(err) {
        if (err) {
          console.error('Error deleting project:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        console.log('✅ Project and related tasks deleted successfully:', id);
        res.json({ success: true });
      });
    });
  });
});

// Task routes
app.get('/api/tasks', authenticateToken, (req, res) => {
  db.all('SELECT * FROM tasks ORDER BY date DESC', (err, tasks) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(tasks.map(task => ({
      ...task,
      clientId: task.client_id,
      projectId: task.project_id,
      finished: Boolean(task.finished),
      isRecurring: Boolean(task.is_recurring),
      recurringWeekend: Boolean(task.recurring_weekend),
      billed: Boolean(task.billed),
      paid: Boolean(task.paid),
      approvedBy: task.approved_by,
      receiptRef: task.receipt_ref,
      approvalStatus: task.approval_status || 'pending'
    })));
  });
});

app.post('/api/tasks', authenticateToken, (req, res) => {
  const {
    id, clientId, projectId, description, hours, cost, date, type,
    status, priority, finished, notes, completedAt, assignedTo,
    isRecurring, recurringDay, recurringWeekend, recurringWeekendType,
    recurringWeekendDay, recurringEndDate, accepted, acceptedAt
  } = req.body;

  console.log('📝 [API] Creating task with data:', { id, clientId, projectId, description });

  db.run(`INSERT INTO tasks (
    id, client_id, project_id, description, hours, cost, date, type,
    status, priority, finished, notes, completed_at, assigned_to,
    is_recurring, recurring_day, recurring_weekend, recurring_weekend_type,
    recurring_weekend_day, recurring_end_date, accepted, accepted_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, clientId, projectId, description, hours, cost, date, type,
      status, priority, finished ? 1 : 0, notes, completedAt, assignedTo,
      isRecurring ? 1 : 0, recurringDay, recurringWeekend ? 1 : 0,
      recurringWeekendType, recurringWeekendDay, recurringEndDate,
      accepted ? 1 : 0, acceptedAt
    ],
    function(err) {
      if (err) {
        console.error('❌ [API] Error inserting task:', err);
        return res.status(500).json({ error: 'Database error: ' + err.message });
      }
      console.log('✅ [API] Task created successfully with id:', id);

      // Log activity
      logActivity('created', 'task', id, description || 'Untitled Task', {
        type,
        hours,
        cost,
        status,
        finished,
        date,
        clientId,
        projectId
      }, req.user?.id);

      // Verify the task was saved by reading it back
      db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, task) => {
        if (err) {
          console.error('❌ [API] Error verifying task:', err);
        } else if (task) {
          console.log('✅ [API] Task verified in database:', task);
        } else {
          console.error('❌ [API] Task not found after insert!');
        }
      });

      res.json({ success: true, id });
    }
  );
});

app.put('/api/tasks/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const {
    clientId, projectId,
    description, hours, cost, date, type, status, priority,
    finished, notes, completedAt, accepted, acceptedAt,
    billed, billedAt, paid, paidAt, invoiceNumber,
    isRecurring, approvedBy, vendor, receiptRef, approvalStatus
  } = req.body;

  db.run(`UPDATE tasks SET
    client_id = COALESCE(?, client_id), project_id = COALESCE(?, project_id),
    description = ?, hours = ?, cost = ?, date = ?, type = ?,
    status = ?, priority = ?, finished = ?, notes = ?, completed_at = ?,
    accepted = ?, accepted_at = ?,
    billed = ?, billedAt = ?, paid = ?, paidAt = ?, invoiceNumber = ?,
    is_recurring = ?,
    approved_by = COALESCE(?, approved_by),
    vendor = COALESCE(?, vendor),
    receipt_ref = COALESCE(?, receipt_ref),
    approval_status = COALESCE(?, approval_status)
    WHERE id = ?`,
    [clientId || null, projectId || null,
     description, hours, cost, date, type, status, priority,
     finished ? 1 : 0, notes, completedAt, accepted ? 1 : 0, acceptedAt,
     billed ? 1 : 0, billedAt, paid ? 1 : 0, paidAt, invoiceNumber,
     isRecurring ? 1 : 0,
     approvedBy || null, vendor || null, receiptRef || null, approvalStatus || null,
     id],
    function(err) {
      if (err) {
        console.error('❌ Database error updating task:', err);
        return res.status(500).json({ error: 'Database error', details: err.message });
      }
      if (this.changes === 0) {
        console.warn('⚠️ No task found with id:', id);
        return res.status(404).json({ error: 'Task not found' });
      }
      console.log('✅ Task updated successfully:', id);
      // Log activity
      logActivity('updated', 'task', id, description || 'Untitled Task', {
        type,
        hours,
        cost,
        status,
        finished,
        date,
        clientId,
        projectId
      }, req.user?.id);
      res.json({ success: true });
    }
  );
});

app.delete('/api/tasks/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  // Get task details before deletion
  db.get('SELECT description FROM tasks WHERE id = ?', [id], (err, task) => {
    const taskName = task?.description || 'Unknown Task';

    db.run('DELETE FROM tasks WHERE id = ?', [id], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      // Log activity
      logActivity('deleted', 'task', id, taskName, null, req.user?.id);
      res.json({ success: true });
    });
  });
});

// Recurring Tasks routes
app.get('/api/recurring-tasks', authenticateToken, (req, res) => {
  db.all('SELECT * FROM recurring_tasks ORDER BY next_due ASC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

app.post('/api/recurring-tasks', authenticateToken, (req, res) => {
  const {
    id, name, description, type, priority, clientId, projectId,
    dayOfMonth, estimatedHours, estimatedCost, isActive, nextDue, recurringStartDate,
    recurringWeekend, recurringWeekendType, recurringWeekendDay, recurringEndDate
  } = req.body;

  db.run(
    `INSERT INTO recurring_tasks
    (id, name, description, type, priority, client_id, project_id, day_of_month,
     estimated_hours, estimated_cost, is_active, next_due, recurring_start_date, recurring_weekend,
     recurring_weekend_type, recurring_weekend_day, recurring_end_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name, description, type, priority, clientId, projectId, dayOfMonth,
     estimatedHours, estimatedCost, isActive ? 1 : 0, nextDue, recurringStartDate, recurringWeekend ? 1 : 0,
     recurringWeekendType, recurringWeekendDay, recurringEndDate],
    function(err) {
      if (err) {
        console.error('Error creating recurring task:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ success: true, id });
    }
  );
});

app.put('/api/recurring-tasks/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const {
    name, description, type, priority, clientId, projectId, dayOfMonth,
    estimatedHours, estimatedCost, isActive, lastGenerated, nextDue, recurringStartDate,
    recurringWeekend, recurringWeekendType, recurringWeekendDay, recurringEndDate
  } = req.body;

  db.run(
    `UPDATE recurring_tasks SET
    name = ?, description = ?, type = ?, priority = ?, client_id = ?,
    project_id = ?, day_of_month = ?, estimated_hours = ?, estimated_cost = ?,
    is_active = ?, last_generated = ?, next_due = ?, recurring_start_date = ?, recurring_weekend = ?,
    recurring_weekend_type = ?, recurring_weekend_day = ?, recurring_end_date = ?
    WHERE id = ?`,
    [name, description, type, priority, clientId, projectId, dayOfMonth,
     estimatedHours, estimatedCost, isActive ? 1 : 0, lastGenerated, nextDue, recurringStartDate,
     recurringWeekend ? 1 : 0, recurringWeekendType, recurringWeekendDay, recurringEndDate, id],
    function(err) {
      if (err) {
        console.error('Error updating recurring task:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ success: true });
    }
  );
});

app.delete('/api/recurring-tasks/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM recurring_tasks WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ success: true });
  });
});

// Task Templates routes
app.get('/api/task-templates', authenticateToken, (req, res) => {
  db.all('SELECT * FROM task_templates ORDER BY name ASC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

app.post('/api/task-templates', authenticateToken, (req, res) => {
  const {
    id, name, description, type, priority, clientId, projectId,
    estimatedHours, estimatedCost, tags
  } = req.body;

  db.run(
    `INSERT INTO task_templates
    (id, name, description, type, priority, client_id, project_id,
     estimated_hours, estimated_cost, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name, description, type, priority, clientId, projectId,
     estimatedHours, estimatedCost, tags],
    function(err) {
      if (err) {
        console.error('Error creating task template:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ success: true, id });
    }
  );
});

app.put('/api/task-templates/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const {
    name, description, type, priority, clientId, projectId,
    estimatedHours, estimatedCost, tags
  } = req.body;

  db.run(
    `UPDATE task_templates SET
    name = ?, description = ?, type = ?, priority = ?, client_id = ?,
    project_id = ?, estimated_hours = ?, estimated_cost = ?, tags = ?
    WHERE id = ?`,
    [name, description, type, priority, clientId, projectId,
     estimatedHours, estimatedCost, tags, id],
    function(err) {
      if (err) {
        console.error('Error updating task template:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ success: true });
    }
  );
});

app.delete('/api/task-templates/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM task_templates WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ success: true });
  });
});

// User routes
app.put('/api/users/:id/password', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;

  // Verify user is updating their own password or is admin
  if (req.user.id !== id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Get user from database
  db.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    bcrypt.compare(currentPassword, user.password_hash, (err, isValid) => {
      if (err || !isValid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Hash new password
      const newPasswordHash = bcrypt.hashSync(newPassword, 10);

      // Update password
      db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newPasswordHash, id], (err) => {
        if (err) {
          console.error('Error updating password:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true });
      });
    });
  });
});

// Public endpoint for client reports
app.get('/api/public/client-report/:slug/:year/:month', (req, res) => {
  const { slug, year, month } = req.params;

  console.log('🌐 Public report request:', { slug, year, month });

  db.get('SELECT * FROM clients WHERE slug = ?', [slug], (err, client) => {
    if (err) {
      console.error('Error fetching client:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!client) {
      console.log('❌ Client not found for slug:', slug);
      return res.status(404).json({ error: 'Client not found' });
    }

    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

    db.all(
      `SELECT * FROM tasks
       WHERE client_id = ?
       AND date >= ?
       AND date <= ?
       AND finished = 1
       ORDER BY date DESC`,
      [client.id, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]],
      (err, tasks) => {
        if (err) {
          console.error('Error fetching tasks:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        db.all(
          'SELECT * FROM projects WHERE client_id = ?',
          [client.id],
          (err, projects) => {
            if (err) {
              console.error('Error fetching projects:', err);
              return res.status(500).json({ error: 'Database error' });
            }

            console.log('✅ Public report data:', {
              client: client.name,
              tasks: tasks.length,
              projects: projects.length
            });

            // Transform client field names from snake_case to camelCase
            const clientData = {
              id: client.id,
              name: client.name,
              slug: client.slug,
              hourlyRate: client.hourly_rate,
              contactPerson: client.contact_person,
              email: client.email,
              phone: client.phone
            };

            res.json({
              client: clientData,
              tasks,
              projects,
              month: parseInt(month),
              year: parseInt(year)
            });
          }
        );
      }
    );
  });
});

// Public Status Page - Get monitor statuses from Uptime Kuma
app.get('/api/public/status/:slug', async (req, res) => {
  const { slug } = req.params;

  console.log('🌐 Public status page request:', { slug });

  try {
    // Check if status page is enabled for this slug
    db.get('SELECT * FROM status_pages WHERE slug = ? AND enabled = 1', [slug], async (err, statusPage) => {
      if (err) {
        console.error('Error fetching status page:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!statusPage) {
        console.log('❌ Status page not found or disabled for slug:', slug);
        return res.status(404).json({ error: 'Status page not found' });
      }

      // Get Uptime Kuma monitors
      const monitors = await uptimeKumaService.getMonitors();

      if (!monitors || monitors.length === 0) {
        return res.json({
          organizationName: statusPage.organization_name,
          description: statusPage.description,
          monitors: [],
          overallStatus: 'operational',
          lastUpdated: new Date().toISOString()
        });
      }

      // Transform monitors for public display
      const publicMonitors = monitors.map(monitor => ({
        id: monitor.id,
        name: monitor.name,
        type: monitor.type,
        url: monitor.url,
        hostname: monitor.hostname,
        status: monitor.active === 1 ? 'up' : 'down',
        uptime: calculateUptime(monitor),
        lastCheck: monitor.lastCheck || new Date().toISOString(),
        responseTime: monitor.ping || null,
        tags: monitor.tags || []
      }));

      // Calculate overall status
      const downMonitors = publicMonitors.filter(m => m.status === 'down').length;
      const overallStatus = downMonitors === 0
        ? 'operational'
        : downMonitors < publicMonitors.length
        ? 'degraded'
        : 'outage';

      res.json({
        organizationName: statusPage.organization_name,
        description: statusPage.description,
        monitors: publicMonitors,
        overallStatus,
        lastUpdated: new Date().toISOString()
      });
    });
  } catch (error) {
    console.error('Error generating status page:', error);
    res.status(500).json({ error: 'Failed to generate status page' });
  }
});

// Helper function to calculate uptime percentage
function calculateUptime(monitor) {
  // Calculate based on 30-day uptime if available
  if (monitor.uptime30) {
    return monitor.uptime30 * 100;
  }
  // Default to 100% if no data or monitor is up
  return monitor.active === 1 ? 99.9 : 95.0;
}

// Backup - Export all data
app.get('/api/backup', authenticateToken, (req, res) => {
  console.log('📦 Exporting database backup...');

  const backup = {
    exportDate: new Date().toISOString(),
    version: '2.0',
    exportedBy: req.user?.username || 'unknown',
    metadata: {},
    data: {}
  };

  // Export clients
  db.all('SELECT * FROM clients', (err, clients) => {
    if (err) {
      console.error('Error exporting clients:', err);
      return res.status(500).json({ error: 'Failed to export clients' });
    }
    backup.data.clients = clients;

    // Export projects
    db.all('SELECT * FROM projects', (err, projects) => {
      if (err) {
        console.error('Error exporting projects:', err);
        return res.status(500).json({ error: 'Failed to export projects' });
      }
      backup.data.projects = projects;

      // Export tasks
      db.all('SELECT * FROM tasks', (err, tasks) => {
        if (err) {
          console.error('Error exporting tasks:', err);
          return res.status(500).json({ error: 'Failed to export tasks' });
        }
        backup.data.tasks = tasks;

        // Export recurring tasks
        db.all('SELECT * FROM recurring_tasks', (err, recurringTasks) => {
          if (err) {
            console.error('Error exporting recurring_tasks:', err);
            return res.status(500).json({ error: 'Failed to export recurring tasks' });
          }
          backup.data.recurringTasks = recurringTasks || [];

          // Export task templates
          db.all('SELECT * FROM task_templates', (err, taskTemplates) => {
            if (err) {
              console.error('Error exporting task_templates:', err);
              return res.status(500).json({ error: 'Failed to export task templates' });
            }
            backup.data.taskTemplates = taskTemplates || [];

            // Add metadata with counts
            backup.metadata = {
              totalClients: clients.length,
              totalProjects: projects.length,
              totalTasks: tasks.length,
              totalRecurringTasks: recurringTasks?.length || 0,
              totalTaskTemplates: taskTemplates?.length || 0,
              totalRecords: clients.length + projects.length + tasks.length + (recurringTasks?.length || 0) + (taskTemplates?.length || 0)
            };

            console.log('✅ Backup created:', backup.metadata);

            res.json(backup);
          });
        });
      });
    });
  });
});

// Restore - Import data
app.post('/api/restore', authenticateToken, (req, res) => {
  // Support both formats: { data: {...} } and the full backup object
  const data = req.body.data || req.body;

  if (!data || !data.clients || !data.projects || !data.tasks) {
    return res.status(400).json({ error: 'Invalid backup format' });
  }

  console.log('📥 Restoring database from backup...');
  console.log('Data to restore:', {
    clients: data.clients.length,
    projects: data.projects.length,
    tasks: data.tasks.length,
    recurringTasks: data.recurringTasks?.length || 0,
    taskTemplates: data.taskTemplates?.length || 0
  });

  // Start transaction
  db.serialize(() => {
    // Clear existing data
    db.run('DELETE FROM tasks', (err) => {
      if (err) {
        console.error('Error clearing tasks:', err);
        return res.status(500).json({ error: 'Failed to clear tasks' });
      }

      db.run('DELETE FROM projects', (err) => {
        if (err) {
          console.error('Error clearing projects:', err);
          return res.status(500).json({ error: 'Failed to clear projects' });
        }

        db.run('DELETE FROM clients', (err) => {
          if (err) {
            console.error('Error clearing clients:', err);
            return res.status(500).json({ error: 'Failed to clear clients' });
          }

          // Insert clients
          const clientStmt = db.prepare(`INSERT INTO clients
            (id, name, slug, hourly_rate, contact_person, email, phone, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
          data.clients.forEach(client => {
            try {
              clientStmt.run([
                client.id,
                client.name,
                client.slug,
                client.hourly_rate || 0,
                client.contact_person || null,
                client.email || null,
                client.phone || null,
                client.created_at
              ]);
            } catch (err) {
              console.error(`Error importing client "${client.name}":`, err);
            }
          });
          clientStmt.finalize();

          // Insert projects
          const projectStmt = db.prepare(`INSERT INTO projects
            (id, client_id, name, description, start_date, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`);
          data.projects.forEach(project => {
            try {
              projectStmt.run([
                project.id,
                project.client_id,
                project.name,
                project.description || null,
                project.start_date || null,
                project.status || 'active',
                project.created_at
              ]);
            } catch (err) {
              console.error(`Error importing project "${project.name}":`, err);
            }
          });
          projectStmt.finalize();

          // Insert tasks
          const taskStmt = db.prepare(`INSERT INTO tasks
            (id, client_id, project_id, description, hours, cost, date, type,
             status, priority, finished, notes, completed_at, assigned_to,
             is_recurring, recurring_day, recurring_weekend, recurring_weekend_type,
             recurring_weekend_day, recurring_end_date, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
          data.tasks.forEach(task => {
            try {
              // Backward compatibility: convert old status values to new workflow statuses
              let taskStatus = task.status || 'in_progress';
              if (taskStatus === 'pending') taskStatus = 'not_started';
              if (taskStatus === 'in-progress') taskStatus = 'in_progress';
              if (taskStatus === 'cancelled') taskStatus = 'completed';

              taskStmt.run([
                task.id,
                task.client_id || '',
                task.project_id || '',
                task.description,
                task.hours || null,
                task.cost || null,
                task.date,
                task.type || 'request',
                taskStatus,
                task.priority || 'medium',
                task.finished ? 1 : 0,
                task.notes || null,
                task.completed_at || null,
                task.assigned_to || null,
                task.is_recurring ? 1 : 0,
                task.recurring_day || null,
                task.recurring_weekend ? 1 : 0,
                task.recurring_weekend_type || null,
                task.recurring_weekend_day || null,
                task.recurring_end_date || null,
                task.created_at
              ]);
            } catch (err) {
              console.error(`Error importing task "${task.description}":`, err);
            }
          });
          taskStmt.finalize(() => {
            // Insert recurring tasks (if present in backup)
            if (data.recurringTasks && data.recurringTasks.length > 0) {
              const recurringStmt = db.prepare(`INSERT INTO recurring_tasks
                (id, name, description, type, priority, client_id, project_id, day_of_month,
                 estimated_hours, estimated_cost, is_active, last_generated, next_due,
                 recurring_weekend, recurring_weekend_type, recurring_weekend_day, recurring_end_date, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

              data.recurringTasks.forEach(rt => {
                if (!rt.client_id || !rt.project_id) {
                  console.warn(`Skipping recurring task "${rt.name}" - missing client_id or project_id`);
                  return;
                }

                try {
                  recurringStmt.run([
                    rt.id,
                    rt.name,
                    rt.description,
                    rt.type || 'request',
                    rt.priority || 'medium',
                    rt.client_id,
                    rt.project_id,
                    rt.day_of_month,
                    rt.estimated_hours || null,
                    rt.estimated_cost || null,
                    rt.is_active !== undefined ? rt.is_active : 1,
                    rt.last_generated || null,
                    rt.next_due,
                    rt.recurring_weekend ? 1 : 0,
                    rt.recurring_weekend_type || null,
                    rt.recurring_weekend_day || null,
                    rt.recurring_end_date || null,
                    rt.created_at || new Date().toISOString()
                  ]);
                } catch (err) {
                  console.error(`Error importing recurring task "${rt.name}":`, err);
                }
              });
              recurringStmt.finalize();
            }

            // Insert task templates (if present in backup)
            if (data.taskTemplates && data.taskTemplates.length > 0) {
              const templateStmt = db.prepare(`INSERT INTO task_templates
                (id, name, description, type, priority, client_id, project_id,
                 estimated_hours, estimated_cost, tags, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

              data.taskTemplates.forEach(tt => {
                try {
                  templateStmt.run([
                    tt.id,
                    tt.name,
                    tt.description,
                    tt.type || 'request',
                    tt.priority || 'medium',
                    tt.client_id || null,
                    tt.project_id || null,
                    tt.estimated_hours || null,
                    tt.estimated_cost || null,
                    tt.tags || null,
                    tt.created_at || new Date().toISOString()
                  ]);
                } catch (err) {
                  console.error(`Error importing task template "${tt.name}":`, err);
                }
              });
              templateStmt.finalize();
            }

            console.log('✅ Database restored successfully');
            res.json({
              success: true,
              restored: {
                clients: data.clients.length,
                projects: data.projects.length,
                tasks: data.tasks.length,
                recurringTasks: data.recurringTasks?.length || 0,
                taskTemplates: data.taskTemplates?.length || 0
              }
            });
          });
        });
      });
    });
  });
});

// Stats summary (used by sidebar info box)
app.get('/api/stats', authenticateToken, (req, res) => {
  db.all(`
    SELECT
      (SELECT COUNT(*) FROM tasks)            AS tasks,
      (SELECT COUNT(*) FROM clients)          AS clients,
      (SELECT COUNT(*) FROM projects)         AS projects,
      (SELECT COUNT(*) FROM recurring_tasks)  AS recurring
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const r = rows[0];
    res.json({
      tasks:     r.tasks,
      clients:   r.clients,
      projects:  r.projects,
      recurring: r.recurring,
      total:     r.tasks + r.clients + r.projects + r.recurring
    });
  });
});

// Health check
app.get('/api/health', (req, res) => {
  // Check database connectivity
  db.get('SELECT COUNT(*) as count FROM clients', (err, result) => {
    if (err) {
      console.error('❌ [Health Check] Database error:', err);
      return res.status(500).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: err.message
      });
    }

    console.log('✅ [Health Check] Database is healthy, clients count:', result.count);
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
      dbPath: dbPath,
      clientCount: result.count
    });
  });
});

// Activity Logs API
app.get('/api/activity-logs', authenticateToken, (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const offset = parseInt(req.query.offset) || 0;

  db.all(
    `SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset],
    (err, logs) => {
      if (err) {
        console.error('Error fetching activity logs:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      // Parse JSON details
      const parsedLogs = logs.map(log => ({
        ...log,
        details: log.details ? JSON.parse(log.details) : null
      }));

      res.json(parsedLogs);
    }
  );
});

// Uptime Kuma Integration
const uptimeKumaService = new UptimeKumaService(db);

// Uptime Kuma API endpoints
app.get('/api/uptime-kuma/config', authenticateToken, async (req, res) => {
  try {
    const config = await uptimeKumaService.loadConfig();
    // Don't send password to frontend
    const { password, ...safeConfig } = config;
    res.json(safeConfig);
  } catch (error) {
    console.error('Error loading Uptime Kuma config:', error);
    res.status(500).json({ error: 'Failed to load configuration' });
  }
});

app.post('/api/uptime-kuma/config', authenticateToken, async (req, res) => {
  try {
    const config = req.body;
    await uptimeKumaService.saveConfig(config);

    // Reconnect if configuration changed
    await uptimeKumaService.reconnect();

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving Uptime Kuma config:', error);
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

app.get('/api/uptime-kuma/status', authenticateToken, (req, res) => {
  const status = uptimeKumaService.getStatus();
  res.json(status);
});

app.post('/api/uptime-kuma/connect', authenticateToken, async (req, res) => {
  try {
    await uptimeKumaService.connect();
    res.json({ success: true });
  } catch (error) {
    console.error('Error connecting to Uptime Kuma:', error);
    res.status(500).json({ error: 'Failed to connect' });
  }
});

app.post('/api/uptime-kuma/disconnect', authenticateToken, (req, res) => {
  uptimeKumaService.disconnect();
  res.json({ success: true });
});

// Status Page Management
app.get('/api/status-pages', authenticateToken, (req, res) => {
  db.all('SELECT * FROM status_pages ORDER BY created_at DESC', (err, pages) => {
    if (err) {
      console.error('Error fetching status pages:', err);
      return res.status(500).json({ error: 'Failed to fetch status pages' });
    }
    res.json(pages);
  });
});

app.post('/api/status-pages', authenticateToken, (req, res) => {
  const { slug, organizationName, description, enabled } = req.body;
  const id = `status-${Date.now()}`;

  db.run(
    `INSERT INTO status_pages (id, slug, organization_name, description, enabled)
     VALUES (?, ?, ?, ?, ?)`,
    [id, slug, organizationName, description, enabled ? 1 : 0],
    function(err) {
      if (err) {
        console.error('Error creating status page:', err);

        // Check for unique constraint violation
        if (err.code === 'SQLITE_CONSTRAINT' && err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'A status page with this slug already exists' });
        }

        return res.status(500).json({ error: 'Failed to create status page' });
      }

      db.get('SELECT * FROM status_pages WHERE id = ?', [id], (err, page) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to fetch created page' });
        }
        res.json(page);
      });
    }
  );
});

app.put('/api/status-pages/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { slug, organizationName, description, enabled } = req.body;

  db.run(
    `UPDATE status_pages
     SET slug = ?, organization_name = ?, description = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [slug, organizationName, description, enabled ? 1 : 0, id],
    function(err) {
      if (err) {
        console.error('Error updating status page:', err);
        return res.status(500).json({ error: 'Failed to update status page' });
      }

      db.get('SELECT * FROM status_pages WHERE id = ?', [id], (err, page) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to fetch updated page' });
        }
        res.json(page);
      });
    }
  );
});

app.delete('/api/status-pages/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM status_pages WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Error deleting status page:', err);
      return res.status(500).json({ error: 'Failed to delete status page' });
    }
    res.json({ success: true });
  });
});

// Monitor Mappings
app.get('/api/monitor-mappings', authenticateToken, (req, res) => {
  db.all('SELECT * FROM monitor_mappings', (err, mappings) => {
    if (err) {
      console.error('Error fetching monitor mappings:', err);
      return res.status(500).json({ error: 'Failed to fetch monitor mappings' });
    }
    res.json(mappings);
  });
});

app.post('/api/monitor-mappings', authenticateToken, (req, res) => {
  const mappings = req.body;

  if (!Array.isArray(mappings)) {
    return res.status(400).json({ error: 'Expected an array of mappings' });
  }

  // Delete all existing mappings and insert new ones
  db.run('DELETE FROM monitor_mappings', (err) => {
    if (err) {
      console.error('Error deleting old mappings:', err);
      return res.status(500).json({ error: 'Failed to clear old mappings' });
    }

    // Insert new mappings
    const stmt = db.prepare(
      `INSERT INTO monitor_mappings (monitor_id, client_id, project_id)
       VALUES (?, ?, ?)`
    );

    let errorOccurred = false;

    mappings.forEach((mapping) => {
      stmt.run(
        mapping.monitor_id,
        mapping.client_id || null,
        mapping.project_id || null,
        (err) => {
          if (err && !errorOccurred) {
            errorOccurred = true;
            console.error('Error inserting mapping:', err);
          }
        }
      );
    });

    stmt.finalize((err) => {
      if (err || errorOccurred) {
        console.error('Error finalizing mappings:', err);
        return res.status(500).json({ error: 'Failed to save mappings' });
      }

      // Return all mappings
      db.all('SELECT * FROM monitor_mappings', (err, allMappings) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to fetch saved mappings' });
        }
        res.json(allMappings);
      });
    });
  });
});

// Company Settings API
app.get('/api/company-settings', authenticateToken, (req, res) => {
  db.get('SELECT * FROM company_settings WHERE id = 1', (err, settings) => {
    if (err) {
      console.error('Error fetching company settings:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!settings) {
      return res.json({
        company_name: 'TaskTracker Pro',
        logo_url: null,
        address: null,
        phone: null,
        email: null,
        website: null,
        tax_id: null
      });
    }

    res.json(settings);
  });
});

app.get('/api/public/company-settings', (req, res) => {
  db.get('SELECT * FROM company_settings WHERE id = 1', (err, settings) => {
    if (err) {
      console.error('Error fetching company settings:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!settings) {
      return res.json({
        company_name: 'TaskTracker Pro',
        logo_url: null,
        address: null,
        phone: null,
        email: null,
        website: null,
        tax_id: null
      });
    }

    res.json(settings);
  });
});

app.post('/api/company-settings', authenticateToken, (req, res) => {
  const { company_name, logo_url, address, phone, email, website, tax_id } = req.body;

  db.run(
    `INSERT INTO company_settings (id, company_name, logo_url, address, phone, email, website, tax_id)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       company_name = excluded.company_name,
       logo_url = excluded.logo_url,
       address = excluded.address,
       phone = excluded.phone,
       email = excluded.email,
       website = excluded.website,
       tax_id = excluded.tax_id,
       updated_at = CURRENT_TIMESTAMP`,
    [company_name, logo_url, address, phone, email, website, tax_id],
    function(err) {
      if (err) {
        console.error('Error saving company settings:', err);
        return res.status(500).json({ error: 'Failed to save settings' });
      }

      db.get('SELECT * FROM company_settings WHERE id = 1', (err, settings) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to fetch updated settings' });
        }
        res.json(settings);
      });
    }
  );
});

// Quotes API
app.get('/api/quotes', authenticateToken, (req, res) => {
  db.all(
    `SELECT q.*, c.name as client_name
     FROM quotes q
     LEFT JOIN clients c ON q.client_id = c.id
     ORDER BY q.date DESC`,
    (err, quotes) => {
      if (err) {
        console.error('Error fetching quotes:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(quotes);
    }
  );
});

app.get('/api/quotes/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.get(
    `SELECT q.*, c.name as client_name
     FROM quotes q
     LEFT JOIN clients c ON q.client_id = c.id
     WHERE q.id = ?`,
    [id],
    (err, quote) => {
      if (err) {
        console.error('Error fetching quote:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!quote) {
        return res.status(404).json({ error: 'Quote not found' });
      }

      db.all(
        'SELECT * FROM quote_items WHERE quote_id = ? ORDER BY sort_order',
        [id],
        (err, items) => {
          if (err) {
            console.error('Error fetching quote items:', err);
            return res.status(500).json({ error: 'Database error' });
          }

          // Map database fields to frontend expectations
          const lineItems = items.map(item => ({
            id: item.id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.amount // Map 'amount' to 'total'
          }));

          res.json({ ...quote, line_items: lineItems });
        }
      );
    }
  );
});

app.post('/api/quotes', authenticateToken, (req, res) => {
  const { client_id, title, date, expiry_date, notes, terms, tax_rate, items, quote_type } = req.body;
  const id = `quote-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const quoteNumber = `QT-${Date.now().toString().slice(-6)}`;

  let subtotal = 0;
  items.forEach((item) => {
    subtotal += item.quantity * item.unit_price;
  });

  const taxAmount = subtotal * (tax_rate / 100);
  const total = subtotal + taxAmount;

  db.run(
    `INSERT INTO quotes
     (id, quote_number, client_id, title, date, expiry_date, notes, terms,
      subtotal, tax_rate, tax_amount, total, status, quote_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
    [id, quoteNumber, client_id, title, date, expiry_date, notes, terms,
     subtotal, tax_rate, taxAmount, total, quote_type || 'standard'],
    function(err) {
      if (err) {
        console.error('Error creating quote:', err);
        return res.status(500).json({ error: 'Failed to create quote' });
      }

      const stmt = db.prepare(
        `INSERT INTO quote_items (id, quote_id, description, quantity, unit_price, amount, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );

      items.forEach((item, index) => {
        const itemId = `item-${Date.now()}-${index}`;
        const amount = item.quantity * item.unit_price;
        stmt.run(itemId, id, item.description, item.quantity, item.unit_price, amount, index);
      });

      stmt.finalize((err) => {
        if (err) {
          console.error('Error adding quote items:', err);
          return res.status(500).json({ error: 'Failed to add items' });
        }

        res.json({ id, quote_number: quoteNumber });
      });
    }
  );
});

app.put('/api/quotes/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { client_id, title, date, expiry_date, notes, terms, tax_rate, items, status, quote_type } = req.body;

  let subtotal = 0;
  items.forEach((item) => {
    subtotal += item.quantity * item.unit_price;
  });

  const taxAmount = subtotal * (tax_rate / 100);
  const total = subtotal + taxAmount;

  db.run(
    `UPDATE quotes SET
       client_id = ?, title = ?, date = ?, expiry_date = ?, notes = ?, terms = ?,
       subtotal = ?, tax_rate = ?, tax_amount = ?, total = ?, status = ?, quote_type = ?,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [client_id, title, date, expiry_date, notes, terms,
     subtotal, tax_rate, taxAmount, total, status, quote_type || 'standard', id],
    function(err) {
      if (err) {
        console.error('Error updating quote:', err);
        return res.status(500).json({ error: 'Failed to update quote' });
      }

      db.run('DELETE FROM quote_items WHERE quote_id = ?', [id], (err) => {
        if (err) {
          console.error('Error deleting old items:', err);
          return res.status(500).json({ error: 'Failed to update items' });
        }

        const stmt = db.prepare(
          `INSERT INTO quote_items (id, quote_id, description, quantity, unit_price, amount, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        );

        items.forEach((item, index) => {
          const itemId = item.id || `item-${Date.now()}-${index}`;
          const amount = item.quantity * item.unit_price;
          stmt.run(itemId, id, item.description, item.quantity, item.unit_price, amount, index);
        });

        stmt.finalize((err) => {
          if (err) {
            console.error('Error updating quote items:', err);
            return res.status(500).json({ error: 'Failed to update items' });
          }

          res.json({ success: true });
        });
      });
    }
  );
});

app.delete('/api/quotes/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM quotes WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Error deleting quote:', err);
      return res.status(500).json({ error: 'Failed to delete quote' });
    }

    res.json({ success: true });
  });
});

// Monitor Feeds
app.get('/api/monitor-feeds', authenticateToken, (req, res) => {
  db.all('SELECT * FROM monitor_feeds ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('Error fetching monitor feeds:', err);
      return res.status(500).json({ error: 'Failed to fetch monitor feeds' });
    }
    res.json(rows.map(row => ({
      id: row.id,
      name: row.name,
      url: row.url,
      clientId: row.client_id,
      projectId: row.project_id,
      enabled: row.enabled === 1,
      lastChecked: row.last_checked,
      createdAt: row.created_at
    })));
  });
});

app.post('/api/monitor-feeds', authenticateToken, (req, res) => {
  const { name, url, clientId, projectId, enabled } = req.body;
  const id = `feed-${Date.now()}`;
  const createdAt = new Date().toISOString();

  db.run(
    `INSERT INTO monitor_feeds (id, name, url, client_id, project_id, enabled, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, name, url, clientId || null, projectId || null, enabled ? 1 : 0, createdAt],
    function(err) {
      if (err) {
        console.error('Error creating monitor feed:', err);
        return res.status(500).json({ error: 'Failed to create monitor feed' });
      }
      res.json({ id, name, url, clientId, projectId, enabled, createdAt });
    }
  );
});

app.put('/api/monitor-feeds/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name, url, clientId, projectId, enabled } = req.body;

  db.run(
    `UPDATE monitor_feeds
     SET name = ?, url = ?, client_id = ?, project_id = ?, enabled = ?
     WHERE id = ?`,
    [name, url, clientId || null, projectId || null, enabled ? 1 : 0, id],
    function(err) {
      if (err) {
        console.error('Error updating monitor feed:', err);
        return res.status(500).json({ error: 'Failed to update monitor feed' });
      }
      res.json({ success: true });
    }
  );
});

app.delete('/api/monitor-feeds/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM monitor_feeds WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Error deleting monitor feed:', err);
      return res.status(500).json({ error: 'Failed to delete monitor feed' });
    }
    res.json({ success: true });
  });
});

// Proxy endpoint to bypass CORS for external monitor feeds
app.get('/api/monitor-proxy', authenticateToken, async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Failed to fetch from ${url}: ${response.statusText}`
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Monitor proxy error:', error);
    res.status(500).json({
      error: 'Failed to fetch monitor data',
      details: error.message
    });
  }
});

// Serve static files in production - MUST BE AFTER all API routes
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('/app/dist'));

  app.get('*', (req, res) => {
    res.sendFile('/app/dist/index.html');
  });
}

// Start server - MUST BE AFTER all routes
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Auto-connect to Uptime Kuma on startup
  setTimeout(() => {
    uptimeKumaService.connect().catch(err => {
      console.error('Failed to auto-connect to Uptime Kuma:', err);
    });
  }, 3000);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  uptimeKumaService.disconnect();
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
});