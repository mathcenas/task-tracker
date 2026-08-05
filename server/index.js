import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import { Resend } from 'resend';
import rateLimit from 'express-rate-limit';
import UptimeKumaService from './uptime-kuma-service.js';

const { verbose } = sqlite3;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Trust the reverse proxy in front of the container (nginx/Caddy/etc.) so
// req.ip reflects the real client IP instead of the proxy's, which the
// onboarding rate limiter below relies on.
app.set('trust proxy', 1);

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

// Resend client for transactional email (onboarding/offboarding confirmations)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
if (!resend) {
  console.warn('⚠️  RESEND_API_KEY not set - onboarding confirmation emails will be skipped');
}

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
      reported_by TEXT,
      published_at DATETIME,
      recurring_task_id TEXT,
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
    )`,

    `CREATE TABLE IF NOT EXISTS onboarding_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      manager_email TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('alta', 'baja')),
      employee_name TEXT NOT NULL,
      role TEXT,
      effective_date TEXT,
      details TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      client_id TEXT,
      project_id TEXT,
      task_id TEXT,
      extra_services TEXT,
      cc_emails TEXT,
      reminder_sent_at DATETIME,
      access_types TEXT,
      access_types_done TEXT,
      source TEXT
    )`,

    `CREATE TABLE IF NOT EXISTS task_notes (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      note TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
    )`,

    `CREATE TABLE IF NOT EXISTS onboarding_updates (
      id TEXT PRIMARY KEY,
      onboarding_request_id INTEGER NOT NULL,
      kind TEXT NOT NULL DEFAULT 'note' CHECK(kind IN ('checklist', 'note')),
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (onboarding_request_id) REFERENCES onboarding_requests (id) ON DELETE CASCADE
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
    `ALTER TABLE clients ADD COLUMN archived BOOLEAN DEFAULT 0`,
    `ALTER TABLE tasks ADD COLUMN billed BOOLEAN DEFAULT 0`,
    `ALTER TABLE tasks ADD COLUMN billedAt DATETIME`,
    `ALTER TABLE tasks ADD COLUMN paid BOOLEAN DEFAULT 0`,
    `ALTER TABLE tasks ADD COLUMN paidAt DATETIME`,
    `ALTER TABLE tasks ADD COLUMN invoiceNumber TEXT`,
    `ALTER TABLE tasks ADD COLUMN accepted BOOLEAN DEFAULT 0`,
    `ALTER TABLE tasks ADD COLUMN accepted_at DATETIME`,
    `ALTER TABLE recurring_tasks ADD COLUMN recurring_start_date DATE`,
    `ALTER TABLE quotes ADD COLUMN quote_type TEXT DEFAULT 'standard'`,
    `ALTER TABLE onboarding_requests ADD COLUMN client_id TEXT`,
    `ALTER TABLE onboarding_requests ADD COLUMN project_id TEXT`,
    `ALTER TABLE onboarding_requests ADD COLUMN task_id TEXT`,
    `ALTER TABLE onboarding_requests ADD COLUMN extra_services TEXT`,
    `ALTER TABLE onboarding_requests ADD COLUMN cc_emails TEXT`,
    `ALTER TABLE onboarding_requests ADD COLUMN reminder_sent_at DATETIME`,
    `ALTER TABLE onboarding_requests ADD COLUMN access_types TEXT`,
    `ALTER TABLE onboarding_requests ADD COLUMN access_types_done TEXT`,
    `ALTER TABLE onboarding_requests ADD COLUMN source TEXT`,
    `ALTER TABLE tasks ADD COLUMN reported_by TEXT`,
    `ALTER TABLE tasks ADD COLUMN published_at DATETIME`,
    `ALTER TABLE tasks ADD COLUMN recurring_task_id TEXT`,
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

app.patch('/api/clients/:id/archive', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { archived } = req.body;
  db.run(`UPDATE clients SET archived = ? WHERE id = ?`, [archived ? 1 : 0, id], function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    db.get('SELECT name FROM clients WHERE id = ?', [id], (_, client) => {
      logActivity(archived ? 'archived' : 'unarchived', 'client', id, client?.name || id, {}, req.user?.id);
    });
    res.json({ success: true, archived: Boolean(archived) });
  });
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
      approvalStatus: task.approval_status || 'pending',
      reportedBy: task.reported_by,
      publishedAt: task.published_at
    })));
  });
});

app.post('/api/tasks', authenticateToken, (req, res) => {
  const {
    id, clientId, projectId, description, hours, cost, date, type,
    status, priority, finished, notes, completedAt, assignedTo,
    isRecurring, recurringDay, recurringWeekend, recurringWeekendType,
    recurringWeekendDay, recurringEndDate, accepted, acceptedAt, reportedBy
  } = req.body;

  console.log('📝 [API] Creating task with data:', { id, clientId, projectId, description });

  db.run(`INSERT INTO tasks (
    id, client_id, project_id, description, hours, cost, date, type,
    status, priority, finished, notes, completed_at, assigned_to,
    is_recurring, recurring_day, recurring_weekend, recurring_weekend_type,
    recurring_weekend_day, recurring_end_date, accepted, accepted_at, reported_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, clientId, projectId, description, hours, cost, date, type,
      status, priority, finished ? 1 : 0, notes, completedAt, assignedTo,
      isRecurring ? 1 : 0, recurringDay, recurringWeekend ? 1 : 0,
      recurringWeekendType, recurringWeekendDay, recurringEndDate,
      accepted ? 1 : 0, acceptedAt, reportedBy || null
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

      publishTaskOpenedIfApplicable({ id, clientId, projectId, type, description, reportedBy });

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
    isRecurring, approvedBy, vendor, receiptRef, approvalStatus, reportedBy
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
    approval_status = COALESCE(?, approval_status),
    reported_by = COALESCE(?, reported_by)
    WHERE id = ?`,
    [clientId || null, projectId || null,
     description, hours, cost, date, type, status, priority,
     finished ? 1 : 0, notes, completedAt, accepted ? 1 : 0, acceptedAt,
     billed ? 1 : 0, billedAt, paid ? 1 : 0, paidAt, invoiceNumber,
     isRecurring ? 1 : 0,
     approvedBy || null, vendor || null, receiptRef || null, approvalStatus || null,
     reportedBy || null,
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

// Push a Problem/Change to an external portal, if configured, on both the
// 'opened' (creation) and 'closed' (resolution) events - the portal tells
// them apart via payload.event. No-op (not an error) when
// EXTERNAL_PORTAL_WEBHOOK_URL isn't set.
const publishTaskToExternalPortal = async (task, client, project, notes, event) => {
  const webhookUrl = process.env.EXTERNAL_PORTAL_WEBHOOK_URL;
  if (!webhookUrl) return { attempted: false };

  const payload = {
    event, // 'opened' | 'closed'
    id: task.id,
    type: task.type,
    description: task.description,
    reportedBy: task.reported_by || null,
    client: client ? { id: client.id, name: client.name, slug: client.slug } : null,
    project: project ? { id: project.id, name: project.name } : null,
    notes: notes.map((n) => ({ note: n.note, createdAt: n.created_at })),
    timestamp: new Date().toISOString()
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.EXTERNAL_PORTAL_WEBHOOK_TOKEN
          ? { Authorization: `Bearer ${process.env.EXTERNAL_PORTAL_WEBHOOK_TOKEN}` }
          : {})
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error(`❌ [Portal] Webhook rejected the ${event} publish (HTTP ${response.status})`);
      return { attempted: true, success: false, status: response.status };
    }

    console.log(`✅ [Portal] Published task ${task.id} (${event}) to the external portal`);
    return { attempted: true, success: true };
  } catch (error) {
    console.error(`❌ [Portal] Error publishing the ${event} event to the external portal:`, error);
    return { attempted: true, success: false, error: error.message };
  }
};

// Fire the 'opened' portal event right after a Problem/Change task is
// created. Fire-and-forget: never blocks or fails the task creation.
const publishTaskOpenedIfApplicable = (task) => {
  if (!process.env.EXTERNAL_PORTAL_WEBHOOK_URL) return;
  if (!['problem', 'change'].includes(task.type)) return;

  db.get('SELECT * FROM clients WHERE id = ?', [task.clientId], (err, client) => {
    if (err) {
      console.error('❌ [Portal] Error fetching client for opened-event publish:', err);
      return;
    }
    db.get('SELECT * FROM projects WHERE id = ?', [task.projectId], (err2, project) => {
      if (err2) {
        console.error('❌ [Portal] Error fetching project for opened-event publish:', err2);
        return;
      }
      publishTaskToExternalPortal(
        { id: task.id, type: task.type, description: task.description, reported_by: task.reportedBy },
        client,
        project,
        [],
        'opened'
      );
    });
  });
};

// Email the client a summary of a closed Problem/Change, reusing the same
// branded header/footer as the onboarding emails. No-op if Resend isn't
// configured or the client has no email on file.
const sendTaskCloseSummaryEmail = async (task, client, project, notes) => {
  if (!resend) return { attempted: false };
  if (!client?.email) return { attempted: false, reason: 'client has no email on file' };

  const typeLabel = task.type === 'problem' ? 'Problema' : 'Cambio';
  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
      ${emailHeader()}
      <h2 style="color: #111827;">${escapeHtml(typeLabel)} resuelto</h2>
      <p>Hola,</p>
      <p>Te confirmamos que el siguiente ${escapeHtml(typeLabel.toLowerCase())}${project ? ` de <strong>${escapeHtml(project.name)}</strong>` : ''} fue resuelto:</p>
      <p style="background: #f9fafb; border-radius: 8px; padding: 12px; font-size: 13px; white-space: pre-wrap;">${escapeHtml(task.description)}</p>
      ${task.reported_by ? `<p style="font-size: 13px; color: #6b7280;">Reportado por: ${escapeHtml(task.reported_by)}</p>` : ''}

      ${notes.length > 0 ? `
        <h3 style="color: #111827; margin-top: 24px;">Detalle de lo realizado</h3>
        <ul style="padding-left: 20px;">
          ${notes.map((n) => `<li style="margin-bottom: 6px; font-size: 13px;">${escapeHtml(n.note)}</li>`).join('')}
        </ul>
      ` : ''}

      ${emailFooter()}
    </div>
  `;

  const fromAddress = process.env.RESEND_FROM_EMAIL || 'onboarding@tasktracker.pro';

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: client.email,
      ...(adminNotificationEmail ? { bcc: adminNotificationEmail } : {}),
      reply_to: emailReplyTo,
      subject: `${typeLabel} resuelto - ${task.description.slice(0, 80)}`,
      html
    });

    if (error) {
      console.error('❌ [Task Close] Resend rejected the summary email:', error);
      return { attempted: true, success: false, error };
    }

    console.log(`✅ [Task Close] Summary email sent to ${client.email} (id: ${data?.id})`);
    return { attempted: true, success: true, id: data?.id };
  } catch (error) {
    console.error('❌ [Task Close] Error sending summary email:', error);
    return { attempted: true, success: false, error: error.message };
  }
};

// Notes ("apuntes") on a task - a running log used mainly for Problem/Change
// tasks while they're being worked, surfaced later in the close summary
app.get('/api/tasks/:id/notes', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM task_notes WHERE task_id = ? ORDER BY created_at ASC',
    [req.params.id],
    (err, rows) => {
      if (err) {
        console.error('❌ Error fetching task notes:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows.map((r) => ({ id: r.id, taskId: r.task_id, note: r.note, createdAt: r.created_at })));
    }
  );
});

app.post('/api/tasks/:id/notes', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { note } = req.body;

  if (!note || !note.trim()) {
    return res.status(400).json({ error: 'note is required' });
  }

  const noteId = crypto.randomUUID();
  db.run(
    'INSERT INTO task_notes (id, task_id, note) VALUES (?, ?, ?)',
    [noteId, id, note.trim()],
    (err) => {
      if (err) {
        console.error('❌ Error adding task note:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ success: true, id: noteId });
    }
  );
});

app.delete('/api/tasks/:id/notes/:noteId', authenticateToken, (req, res) => {
  db.run(
    'DELETE FROM task_notes WHERE id = ? AND task_id = ?',
    [req.params.noteId, req.params.id],
    (err) => {
      if (err) {
        console.error('❌ Error deleting task note:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ success: true });
    }
  );
});

// Close a Problem/Change task: mark it completed, publish it to the external
// portal webhook (if configured) and email the client a summary via Resend
// (if the client has an email on file). Both are best-effort - a failure in
// either doesn't block the close, but is reported back so the admin knows.
app.post('/api/tasks/:id/close', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, task) => {
    if (err) {
      console.error('❌ Error fetching task to close:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    if (!['problem', 'change'].includes(task.type)) {
      return res.status(400).json({ error: 'Only problem/change tasks can be closed this way' });
    }
    if (task.status === 'completed') {
      return res.status(400).json({ error: 'This task is already closed' });
    }

    db.get('SELECT * FROM clients WHERE id = ?', [task.client_id], (err, client) => {
      if (err) {
        console.error('❌ Error fetching client for task close:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      db.get('SELECT * FROM projects WHERE id = ?', [task.project_id], (err, project) => {
        if (err) {
          console.error('❌ Error fetching project for task close:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        db.all('SELECT * FROM task_notes WHERE task_id = ? ORDER BY created_at ASC', [id], async (err, notes) => {
          if (err) {
            console.error('❌ Error fetching notes for task close:', err);
            return res.status(500).json({ error: 'Database error' });
          }

          const now = new Date().toISOString();

          db.run(
            `UPDATE tasks SET status = 'completed', finished = 1, completed_at = ? WHERE id = ?`,
            [now, id],
            async (updateErr) => {
              if (updateErr) {
                console.error('❌ Error closing task:', updateErr);
                return res.status(500).json({ error: 'Database error closing task' });
              }

              logActivity('completed', 'task', id, task.description, {
                type: task.type,
                reportedBy: task.reported_by
              }, req.user?.id);

              const [webhookResult, emailResult] = await Promise.all([
                publishTaskToExternalPortal(task, client, project, notes, 'closed'),
                sendTaskCloseSummaryEmail(task, client, project, notes)
              ]);

              if (webhookResult.attempted && webhookResult.success) {
                db.run('UPDATE tasks SET published_at = ? WHERE id = ?', [new Date().toISOString(), id]);
              }

              res.json({ success: true, webhook: webhookResult, email: emailResult });
            }
          );
        });
      });
    });
  });
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
       AND (finished = 1 OR type = 'insumos')
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

            const clientData = {
              id: client.id,
              name: client.name,
              slug: client.slug,
              hourlyRate: client.hourly_rate,
              contactPerson: client.contact_person,
              email: client.email,
              phone: client.phone
            };

            // Map tasks to camelCase so frontend fields work correctly
            const mappedTasks = tasks.map(t => ({
              id: t.id,
              clientId: t.client_id,
              projectId: t.project_id,
              description: t.description,
              hours: t.hours,
              cost: t.cost,
              date: t.date,
              type: t.type,
              status: t.status,
              priority: t.priority,
              finished: Boolean(t.finished),
              notes: t.notes,
              completedAt: t.completed_at,
              isRecurring: Boolean(t.is_recurring),
              vendor: t.vendor,
              approvedBy: t.approved_by,
              receiptRef: t.receipt_ref,
              approvalStatus: t.approval_status || 'pending',
              createdAt: t.created_at
            }));

            const mappedProjects = projects.map(p => ({
              id: p.id,
              clientId: p.client_id,
              name: p.name,
              description: p.description,
              startDate: p.start_date,
              status: p.status
            }));

            res.json({
              client: clientData,
              tasks: mappedTasks,
              projects: mappedProjects,
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

// ============================================================
// Onboarding / Offboarding requests (Altas y Bajas de Personal)
// ============================================================

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[char]));

const normalizeExtraServices = (extraServices) => {
  if (Array.isArray(extraServices)) {
    return extraServices.map((s) => String(s).trim()).filter(Boolean);
  }
  if (typeof extraServices === 'string') {
    return extraServices.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
};

const normalizeEmailList = (emails) => {
  const list = Array.isArray(emails)
    ? emails
    : (typeof emails === 'string' ? emails.split(/\r?\n|,/) : []);
  return list.map((e) => String(e).trim()).filter((e) => e.includes('@'));
};

const parseJsonArray = (value) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const publicAppUrl = (process.env.PUBLIC_APP_URL || 'https://clientes.cenas-support.com').replace(/\/$/, '');
const onboardingFormUrl = `${publicAppUrl}/onboarding`;
const logoUrl = `${publicAppUrl}/logo%20-%20Copy.png`;

const emailHeader = () => `
  <div style="text-align: center; margin-bottom: 24px;">
    <img src="${logoUrl}" alt="TaskTracker Pro" style="height: 40px; width: auto;" />
  </div>
`;

const emailFooter = () => `
  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
    <p style="color: #6b7280; font-size: 12px; margin: 0 0 6px;">
      ¿Necesitás gestionar otra alta o baja? Podés hacerlo acá:
      <a href="${onboardingFormUrl}" style="color: #2563eb;">${onboardingFormUrl}</a>
    </p>
    <p style="color: #6b7280; font-size: 12px; margin: 0;">Correo generado por TaskTracker Pro, by Cenas Support.</p>
  </div>
`;

// alta -> onboarding@<domain>, baja -> offboarding@<domain>, domain taken from RESEND_FROM_EMAIL
const getFromAddressForType = (type) => {
  const configured = process.env.RESEND_FROM_EMAIL || 'onboarding@tasktracker.pro';
  const atIndex = configured.indexOf('@');
  const domain = atIndex !== -1 ? configured.slice(atIndex + 1) : 'tasktracker.pro';
  return `${type === 'baja' ? 'offboarding' : 'onboarding'}@${domain}`;
};

const adminNotificationEmail = process.env.ADMIN_NOTIFICATION_EMAIL || null;

// Where replies to any outgoing email (onboarding, offboarding, task close
// summaries, stale-request reminders) should land - independent of the bcc
// address above, since that's often a shared inbox rather than a person.
const emailReplyTo = process.env.EMAIL_REPLY_TO || 'mathias@cenas.uy';

// Public: acknowledge that a request was received, before it's processed
const sendOnboardingReceivedEmail = async (request) => {
  if (!resend) return;

  const typeLabel = request.type === 'alta' ? 'Alta' : 'Baja';
  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
      ${emailHeader()}
      <h2 style="color: #111827;">Recibimos tu solicitud</h2>
      <p>Hola,</p>
      <p>Confirmamos que recibimos tu solicitud de <strong>${escapeHtml(typeLabel.toLowerCase())}</strong> de
        <strong>${escapeHtml(request.employeeName)}</strong>. Va a ser procesada a la brevedad y te vamos a
        avisar por este mismo medio apenas quede finalizada.</p>
      ${emailFooter()}
    </div>
  `;

  const fromAddress = getFromAddressForType(request.type);
  console.log(`📧 [Onboarding] Sending "received" acknowledgment to ${request.managerEmail}${adminNotificationEmail ? ` (bcc: ${adminNotificationEmail})` : ''}...`);

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: request.managerEmail,
      ...(adminNotificationEmail ? { bcc: adminNotificationEmail } : {}),
      reply_to: emailReplyTo,
      subject: `Recibimos tu solicitud de ${typeLabel.toLowerCase()} de ${request.employeeName}`,
      html
    });

    if (error) {
      console.error('❌ [Onboarding] Resend rejected the acknowledgment email:', error);
      return;
    }

    console.log(`✅ [Onboarding] Acknowledgment email sent to ${request.managerEmail} (id: ${data?.id})`);
  } catch (error) {
    console.error('❌ [Onboarding] Error sending acknowledgment email:', error);
  }
};

const sendOnboardingConfirmationEmail = async (request, extraServices, ccEmails = []) => {
  if (!resend) return { success: false, error: 'Resend is not configured' };

  const typeLabel = request.type === 'alta' ? 'Alta' : 'Baja';
  const originalDetailsRows = [
    ['Puesto', request.role],
    ['Fecha de efectividad', request.effective_date],
  ].filter(([, value]) => value);

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
      ${emailHeader()}
      <h2 style="color: #111827;">Proceso de ${escapeHtml(typeLabel)} finalizado</h2>
      <p>Hola,</p>
      <p>Te confirmamos que el proceso de <strong>${escapeHtml(typeLabel.toLowerCase())}</strong> de
        <strong>${escapeHtml(request.employee_name)}</strong> ha finalizado correctamente.</p>

      ${originalDetailsRows.length > 0 ? `
        <h3 style="color: #111827; margin-top: 24px;">Detalles de la solicitud</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${originalDetailsRows.map(([label, value]) => `
            <tr>
              <td style="padding: 4px 8px; color: #6b7280; font-size: 13px;">${escapeHtml(label)}</td>
              <td style="padding: 4px 8px; font-size: 13px;">${escapeHtml(value)}</td>
            </tr>
          `).join('')}
        </table>
      ` : ''}

      ${request.details ? `
        <h3 style="color: #111827; margin-top: 24px;">Notas originales</h3>
        <p style="background: #f9fafb; border-radius: 8px; padding: 12px; font-size: 13px; white-space: pre-wrap;">${escapeHtml(request.details)}</p>
      ` : ''}

      <h3 style="color: #111827; margin-top: 24px;">Accesos y servicios configurados</h3>
      ${extraServices.length > 0 ? `
        <ul style="padding-left: 20px;">
          ${extraServices.map((service) => `<li style="margin-bottom: 4px;">${escapeHtml(service)}</li>`).join('')}
        </ul>
      ` : '<p style="color: #6b7280; font-size: 13px;">No se configuraron accesos o servicios adicionales.</p>'}

      ${emailFooter()}
    </div>
  `;

  const fromAddress = getFromAddressForType(request.type);
  console.log(`📧 [Onboarding] Sending confirmation email to ${request.manager_email}${ccEmails.length ? ` (cc: ${ccEmails.join(', ')})` : ''} (from ${fromAddress})...`);

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: request.manager_email,
      ...(ccEmails.length > 0 ? { cc: ccEmails } : {}),
      ...(adminNotificationEmail ? { bcc: adminNotificationEmail } : {}),
      reply_to: emailReplyTo,
      subject: `${typeLabel} de ${request.employee_name} - Proceso finalizado`,
      html
    });

    if (error) {
      console.error('❌ [Onboarding] Resend rejected the email:', error);
      return { success: false, error };
    }

    console.log(`✅ [Onboarding] Confirmation email sent to ${request.manager_email} (id: ${data?.id})`);
    return { success: true, id: data?.id };
  } catch (error) {
    console.error('❌ [Onboarding] Error sending confirmation email:', error);
    return { success: false, error };
  }
};

// Public: managers submit an onboarding/offboarding request - no auth required.
// Rate limited per IP since this endpoint is unauthenticated and each
// submission sends real emails (to the manager, cc'd/bcc'd to the team).
const onboardingRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes desde esta conexión. Por favor intentá nuevamente en unos minutos.' }
});

app.post('/api/public/onboarding', onboardingRateLimiter, (req, res) => {
  const { managerEmail, type, employeeName, role, effectiveDate, details, accessTypes } = req.body;

  if (!managerEmail || !type || !employeeName) {
    return res.status(400).json({ error: 'managerEmail, type and employeeName are required' });
  }
  if (!['alta', 'baja'].includes(type)) {
    return res.status(400).json({ error: "type must be 'alta' or 'baja'" });
  }

  const accessTypesList = normalizeExtraServices(accessTypes);

  db.run(
    `INSERT INTO onboarding_requests (manager_email, type, employee_name, role, effective_date, details, access_types)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [managerEmail, type, employeeName, role || null, effectiveDate || null, details || null,
     accessTypesList.length > 0 ? JSON.stringify(accessTypesList) : null],
    function (err) {
      if (err) {
        console.error('❌ Error creating onboarding request:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      sendOnboardingReceivedEmail({ managerEmail, type, employeeName });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Admin: list all onboarding/offboarding requests (pending and completed), newest first
app.get('/api/admin/onboarding', authenticateToken, (req, res) => {
  db.all(
    `SELECT * FROM onboarding_requests ORDER BY created_at DESC`,
    (err, rows) => {
      if (err) {
        console.error('❌ Error fetching onboarding requests:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    }
  );
});

// Admin: confirm a request - creates the billable task and emails the manager
app.post('/api/admin/onboarding/:id/confirm', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { client_id, project_id, extra_services, cc } = req.body;

  if (!client_id || !project_id) {
    return res.status(400).json({ error: 'client_id and project_id are required' });
  }

  const extraServices = normalizeExtraServices(extra_services);
  const ccEmails = normalizeEmailList(cc);

  db.get('SELECT * FROM onboarding_requests WHERE id = ?', [id], (err, request) => {
    if (err) {
      console.error('❌ Error fetching onboarding request:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!request) {
      return res.status(404).json({ error: 'Onboarding request not found' });
    }
    if (request.status === 'completed') {
      return res.status(400).json({ error: 'This request was already completed' });
    }

    const typeLabel = request.type === 'alta' ? 'Alta' : 'Baja';
    const title = `[${typeLabel}] - ${request.employee_name}`;
    const description = [
      title,
      `Solicitado por: ${request.manager_email}`,
      `Puesto: ${request.role || '-'}`,
      `Fecha de efectividad: ${request.effective_date || '-'}`,
      `Detalles originales: ${request.details || '-'}`,
      extraServices.length > 0
        ? `Servicios extra configurados:\n${extraServices.map((s) => `- ${s}`).join('\n')}`
        : 'Servicios extra configurados: ninguno'
    ].join('\n');

    const taskId = crypto.randomUUID();
    const today = new Date().toISOString().split('T')[0];

    db.run(
      `INSERT INTO tasks (id, client_id, project_id, description, date, type, status, priority)
       VALUES (?, ?, ?, ?, ?, 'request', 'in_progress', 'medium')`,
      [taskId, client_id, project_id, description, today],
      function (taskErr) {
        if (taskErr) {
          console.error('❌ Error creating onboarding task:', taskErr);
          return res.status(500).json({ error: 'Database error creating task' });
        }

        db.run(
          `UPDATE onboarding_requests
           SET status = 'completed', client_id = ?, project_id = ?, task_id = ?, extra_services = ?, cc_emails = ?
           WHERE id = ?`,
          [client_id, project_id, taskId, JSON.stringify(extraServices), JSON.stringify(ccEmails), id],
          (updateErr) => {
            if (updateErr) {
              console.error('❌ Error updating onboarding request:', updateErr);
              return res.status(500).json({ error: 'Database error updating request' });
            }

            logActivity('created', 'task', taskId, title, {
              source: 'onboarding',
              onboardingRequestId: id,
              extraServices
            }, req.user?.id);

            sendOnboardingConfirmationEmail(request, extraServices, ccEmails);

            res.json({ success: true, taskId });
          }
        );
      }
    );
  });
});

// Admin: resend the confirmation email for an already-completed request
app.post('/api/admin/onboarding/:id/resend', authenticateToken, async (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM onboarding_requests WHERE id = ?', [id], async (err, request) => {
    if (err) {
      console.error('❌ Error fetching onboarding request:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!request) {
      return res.status(404).json({ error: 'Onboarding request not found' });
    }
    if (request.status !== 'completed') {
      return res.status(400).json({ error: 'This request has not been processed yet' });
    }
    if (!resend) {
      return res.status(400).json({ error: 'RESEND_API_KEY is not configured on the server' });
    }

    const extraServices = parseJsonArray(request.extra_services);
    const ccEmails = parseJsonArray(request.cc_emails);

    const result = await sendOnboardingConfirmationEmail(request, extraServices, ccEmails);
    if (!result?.success) {
      return res.status(502).json({ error: 'Resend rejected the email', details: result?.error });
    }

    res.json({ success: true });
  });
});

// Send a progress-update email to the requester while a request is still
// being worked on (some offboardings happen in stages - revoke mail today,
// VPN tomorrow, etc.) and log it so there's a record of what was sent when.
const sendOnboardingUpdateEmail = async (request, headline, bodyHtml, extraCc = []) => {
  if (!resend) return { success: false, error: 'Resend is not configured' };

  const typeLabel = request.type === 'alta' ? 'Alta' : 'Baja';
  const ccEmails = Array.from(new Set(normalizeEmailList([...parseJsonArray(request.cc_emails), ...extraCc])));

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
      ${emailHeader()}
      <h2 style="color: #111827;">Actualización de tu ${escapeHtml(typeLabel.toLowerCase())}</h2>
      <p>Hola,</p>
      <p>Te compartimos una actualización sobre el proceso de <strong>${escapeHtml(typeLabel.toLowerCase())}</strong> de
        <strong>${escapeHtml(request.employee_name)}</strong>:</p>
      <p style="background: #f9fafb; border-radius: 8px; padding: 12px; font-size: 13px;">${bodyHtml}</p>
      ${emailFooter()}
    </div>
  `;

  const fromAddress = getFromAddressForType(request.type);

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: request.manager_email,
      ...(ccEmails.length > 0 ? { cc: ccEmails } : {}),
      ...(adminNotificationEmail ? { bcc: adminNotificationEmail } : {}),
      reply_to: emailReplyTo,
      subject: `${headline} - ${request.employee_name}`,
      html
    });

    if (error) {
      console.error('❌ [Onboarding] Resend rejected the update email:', error);
      return { success: false, error };
    }

    console.log(`✅ [Onboarding] Update email sent to ${request.manager_email} (id: ${data?.id})`);
    return { success: true, id: data?.id };
  } catch (error) {
    console.error('❌ [Onboarding] Error sending update email:', error);
    return { success: false, error };
  }
};

// Admin: mark a single access-type checklist item as done/not done. Marking
// one done fires an auto-email to the requester and logs it; un-marking
// (fixing a mistaken click) is silent - no email, no log entry.
app.put('/api/admin/onboarding/:id/access-types', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { accessType, done } = req.body;

  if (!accessType) {
    return res.status(400).json({ error: 'accessType is required' });
  }

  db.get('SELECT * FROM onboarding_requests WHERE id = ?', [id], async (err, request) => {
    if (err) {
      console.error('❌ Error fetching onboarding request:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!request) {
      return res.status(404).json({ error: 'Onboarding request not found' });
    }

    const accessTypesDone = { ...(JSON.parse(request.access_types_done || '{}')) };
    const alreadyDone = Boolean(accessTypesDone[accessType]);

    if (done) {
      accessTypesDone[accessType] = new Date().toISOString();
    } else {
      delete accessTypesDone[accessType];
    }

    db.run(
      'UPDATE onboarding_requests SET access_types_done = ? WHERE id = ?',
      [JSON.stringify(accessTypesDone), id],
      async (updateErr) => {
        if (updateErr) {
          console.error('❌ Error updating access-types checklist:', updateErr);
          return res.status(500).json({ error: 'Database error' });
        }

        if (done && !alreadyDone) {
          const typeLabel = request.type === 'alta' ? 'alta' : 'baja';
          const emailResult = await sendOnboardingUpdateEmail(
            request,
            `Completado: ${accessType}`,
            `Ya completamos <strong>${escapeHtml(accessType)}</strong> como parte del proceso de ${escapeHtml(typeLabel)} de ${escapeHtml(request.employee_name)}.`
          );

          // Only log it as an "update sent" if the email actually went out -
          // otherwise the history would claim the client was notified when
          // they weren't. The checkbox state itself is saved either way.
          if (emailResult?.success) {
            db.run(
              `INSERT INTO onboarding_updates (id, onboarding_request_id, kind, message) VALUES (?, ?, 'checklist', ?)`,
              [crypto.randomUUID(), id, `Completado: ${accessType}`],
              (noteErr) => {
                if (noteErr) console.error('❌ Error logging checklist update:', noteErr);
              }
            );
          }

          return res.json({ success: true, accessTypesDone, emailSent: Boolean(emailResult?.success) });
        }

        res.json({ success: true, accessTypesDone, emailSent: false });
      }
    );
  });
});

// Admin: send a free-text progress update email for anything outside the checklist
app.post('/api/admin/onboarding/:id/update', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { message, cc } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  const extraCc = normalizeEmailList(cc);

  db.get('SELECT * FROM onboarding_requests WHERE id = ?', [id], async (err, request) => {
    if (err) {
      console.error('❌ Error fetching onboarding request:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!request) {
      return res.status(404).json({ error: 'Onboarding request not found' });
    }
    if (!resend) {
      return res.status(400).json({ error: 'RESEND_API_KEY is not configured on the server' });
    }

    const trimmedMessage = message.trim();
    const result = await sendOnboardingUpdateEmail(
      request,
      'Actualización',
      escapeHtml(trimmedMessage).replace(/\n/g, '<br/>'),
      extraCc
    );

    if (!result?.success) {
      return res.status(502).json({ error: 'Resend rejected the email', details: result?.error });
    }

    // Any new CC addresses stick to the request, so later updates (including
    // the automatic checklist emails) keep including them without having to
    // retype them every time.
    if (extraCc.length > 0) {
      const mergedCc = Array.from(new Set([...parseJsonArray(request.cc_emails), ...extraCc]));
      db.run(
        'UPDATE onboarding_requests SET cc_emails = ? WHERE id = ?',
        [JSON.stringify(mergedCc), id],
        (ccErr) => {
          if (ccErr) console.error('❌ Error persisting cc_emails:', ccErr);
        }
      );
    }

    db.run(
      `INSERT INTO onboarding_updates (id, onboarding_request_id, kind, message) VALUES (?, ?, 'note', ?)`,
      [crypto.randomUUID(), id, trimmedMessage],
      (noteErr) => {
        if (noteErr) console.error('❌ Error logging update note:', noteErr);
      }
    );

    res.json({ success: true });
  });
});

// Admin: history of update emails sent for a request (checklist + free-text)
app.get('/api/admin/onboarding/:id/updates', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM onboarding_updates WHERE onboarding_request_id = ? ORDER BY created_at ASC',
    [req.params.id],
    (err, rows) => {
      if (err) {
        console.error('❌ Error fetching onboarding updates:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows.map((r) => ({
        id: r.id,
        onboardingRequestId: r.onboarding_request_id,
        kind: r.kind,
        message: r.message,
        createdAt: r.created_at
      })));
    }
  );
});

// Periodically remind the team about onboarding/offboarding requests that
// have been pending for too long. One reminder per request (tracked via
// reminder_sent_at) so an unprocessed request doesn't spam the team on
// every check. No-op if Resend or ADMIN_NOTIFICATION_EMAIL isn't configured.
const ONBOARDING_STALE_DAYS = parseInt(process.env.ONBOARDING_STALE_DAYS || '2', 10);
const ONBOARDING_STALE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours

const checkStaleOnboardingRequests = () => {
  if (!resend || !adminNotificationEmail) return;

  db.all(
    `SELECT * FROM onboarding_requests
     WHERE status = 'pending' AND reminder_sent_at IS NULL
     AND datetime(created_at) <= datetime('now', ?)`,
    [`-${ONBOARDING_STALE_DAYS} days`],
    async (err, rows) => {
      if (err) {
        console.error('❌ [Onboarding] Error checking stale requests:', err);
        return;
      }
      if (!rows || rows.length === 0) return;

      const html = `
        <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
          ${emailHeader()}
          <h2 style="color: #111827;">Solicitudes pendientes hace más de ${ONBOARDING_STALE_DAYS} día(s)</h2>
          <p>Estas solicitudes de alta/baja todavía no fueron procesadas en el panel:</p>
          <ul style="padding-left: 20px;">
            ${rows.map((r) => `
              <li style="margin-bottom: 8px;">
                <strong>${escapeHtml(r.type === 'alta' ? 'Alta' : 'Baja')}</strong> - ${escapeHtml(r.employee_name)}
                <br /><span style="color: #6b7280; font-size: 13px;">
                  Solicitado por ${escapeHtml(r.manager_email)} el ${escapeHtml(r.created_at)}
                </span>
              </li>
            `).join('')}
          </ul>
          ${emailFooter()}
        </div>
      `;

      try {
        const { data, error } = await resend.emails.send({
          from: getFromAddressForType('alta'),
          to: adminNotificationEmail,
          reply_to: emailReplyTo,
          subject: `${rows.length} solicitud(es) de alta/baja pendiente(s) hace más de ${ONBOARDING_STALE_DAYS} día(s)`,
          html
        });

        if (error) {
          console.error('❌ [Onboarding] Resend rejected the stale-request reminder:', error);
          return;
        }

        console.log(`✅ [Onboarding] Stale-request reminder sent for ${rows.length} request(s) (id: ${data?.id})`);

        const ids = rows.map((r) => r.id);
        db.run(
          `UPDATE onboarding_requests SET reminder_sent_at = CURRENT_TIMESTAMP WHERE id IN (${ids.map(() => '?').join(',')})`,
          ids,
          (updateErr) => {
            if (updateErr) console.error('❌ [Onboarding] Error marking reminders as sent:', updateErr);
          }
        );
      } catch (error) {
        console.error('❌ [Onboarding] Error sending stale-request reminder:', error);
      }
    }
  );
};

setTimeout(() => {
  checkStaleOnboardingRequests();
  setInterval(checkStaleOnboardingRequests, ONBOARDING_STALE_CHECK_INTERVAL_MS);
}, 60 * 1000);

// Generate real `tasks` rows from `recurring_tasks` definitions once they're
// due. This is the ONLY place that does this generation - it runs server-side
// on a timer, independent of any page being open, and is idempotent: each
// generated task is linked back to its recurring definition via
// recurring_task_id, so a task is never generated twice for the same
// definition + due date even if this check overlaps a previous run.
const RECURRING_TASK_CHECK_INTERVAL_MS = 60 * 60 * 1000; // every hour

const getNextWeekendDate = (weekendType, weekendDay, baseDate) => {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const lastDay = new Date(year, month + 1, 0);
  const targetDay = weekendDay === 'saturday' ? 6 : 0;
  const weekends = [];
  for (let date = 1; date <= lastDay.getDate(); date++) {
    if (new Date(year, month, date).getDay() === targetDay) weekends.push(date);
  }
  if (weekends.length === 0) return null;
  let targetDate;
  switch (weekendType) {
    case 'first': targetDate = weekends[0]; break;
    case 'second': targetDate = weekends[1]; break;
    case 'third': targetDate = weekends[2]; break;
    case 'fourth': targetDate = weekends[3]; break;
    case 'last': targetDate = weekends[weekends.length - 1]; break;
    default: targetDate = weekends[0];
  }
  return targetDate ? new Date(year, month, targetDate) : null;
};

const formatDateOnly = (d) => d.toISOString().split('T')[0];

const computeNextDue = (recurringTask, fromDateStr) => {
  const currentDate = new Date(fromDateStr);
  const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);

  if (recurringTask.recurring_weekend) {
    const weekendType = recurringTask.recurring_weekend_type || 'first';
    const weekendDay = recurringTask.recurring_weekend_day || 'saturday';
    let nextWeekendDate = getNextWeekendDate(weekendType, weekendDay, nextMonth);
    if (!nextWeekendDate) {
      const nextNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 1);
      nextWeekendDate = getNextWeekendDate(weekendType, weekendDay, nextNextMonth) || nextNextMonth;
    }
    return formatDateOnly(nextWeekendDate);
  }

  const daysInNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
  const targetDay = Math.min(recurringTask.day_of_month || 1, daysInNextMonth);
  return formatDateOnly(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), targetDay));
};

const generateDueRecurringTasks = () => {
  const today = formatDateOnly(new Date());

  db.all(
    `SELECT * FROM recurring_tasks
     WHERE is_active = 1
       AND next_due <= ?
       AND (recurring_start_date IS NULL OR recurring_start_date <= ?)
       AND (recurring_end_date IS NULL OR recurring_end_date >= ?)`,
    [today, today, today],
    (err, dueTasks) => {
      if (err) {
        console.error('❌ [Recurring] Error fetching due recurring tasks:', err);
        return;
      }
      if (!dueTasks || dueTasks.length === 0) return;

      dueTasks.forEach((recurringTask) => {
        const dueDate = recurringTask.next_due;

        // Idempotency guard: a task for this recurring definition + due date
        // may already exist (e.g. a previous run generated it but the
        // next_due advance below didn't get to run yet). Never insert twice.
        db.get(
          `SELECT id FROM tasks WHERE recurring_task_id = ? AND date = ?`,
          [recurringTask.id, dueDate],
          (checkErr, existing) => {
            if (checkErr) {
              console.error('❌ [Recurring] Error checking for existing generated task:', checkErr);
              return;
            }

            const nextDue = computeNextDue(recurringTask, dueDate);

            if (existing) {
              db.run(
                `UPDATE recurring_tasks SET last_generated = ?, next_due = ? WHERE id = ? AND next_due = ?`,
                [dueDate, nextDue, recurringTask.id, dueDate],
                (advanceErr) => {
                  if (advanceErr) console.error('❌ [Recurring] Error advancing next_due:', advanceErr);
                }
              );
              return;
            }

            const taskId = crypto.randomUUID();

            db.run(
              `INSERT INTO tasks (
                id, client_id, project_id, description, hours, cost, date, type,
                status, priority, finished, notes, is_recurring, recurring_weekend,
                recurring_weekend_type, recurring_weekend_day, recurring_task_id
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                taskId, recurringTask.client_id, recurringTask.project_id,
                `[Recurring] ${recurringTask.description}`,
                recurringTask.estimated_hours, recurringTask.estimated_cost, dueDate,
                recurringTask.type, 'in_progress', recurringTask.priority, 0,
                `Auto-generated from recurring task: ${recurringTask.name}`,
                1, recurringTask.recurring_weekend ? 1 : 0,
                recurringTask.recurring_weekend_type, recurringTask.recurring_weekend_day,
                recurringTask.id
              ],
              (insertErr) => {
                if (insertErr) {
                  console.error('❌ [Recurring] Error generating task from recurring definition:', insertErr);
                  return;
                }

                console.log(`✅ [Recurring] Generated task ${taskId} from recurring task ${recurringTask.id} for ${dueDate}`);
                logActivity('created', 'task', taskId, `[Recurring] ${recurringTask.description}`, {
                  source: 'recurring',
                  recurringTaskId: recurringTask.id
                }, 'system');

                // Only advance if next_due hasn't moved since we read it, so
                // a concurrent run can't double-advance or clobber progress.
                db.run(
                  `UPDATE recurring_tasks SET last_generated = ?, next_due = ? WHERE id = ? AND next_due = ?`,
                  [dueDate, nextDue, recurringTask.id, dueDate],
                  (advanceErr) => {
                    if (advanceErr) console.error('❌ [Recurring] Error advancing next_due:', advanceErr);
                  }
                );
              }
            );
          }
        );
      });
    }
  );
};

setTimeout(() => {
  generateDueRecurringTasks();
  setInterval(generateDueRecurringTasks, RECURRING_TASK_CHECK_INTERVAL_MS);
}, 45 * 1000);

// ============================================================
// Inbound onboarding/offboarding report import (file-drop)
// ============================================================
// Some external systems (access audits, NAS reports, etc.) can name pending
// user actions but have no notion of our clients/projects and no human
// "manager" submitting a request through the public form. Rather than
// exposing a network endpoint, they drop timestamped JSON files into a
// folder bind-mounted into both containers (ONBOARDING_IMPORT_DIR). Expected
// shape:
//   {
//     "service": "NAS Sistemaris",
//     "client": "Sistemaris SRL",          // matched by name against our clients table
//     "generated_at": "2026-08-05T14:00:00Z",
//     "reviewed_at": "2026-08-05T13:45:00Z",
//     "pending_actions": [
//       { "user": "jperez", "action": "eliminar", "note": "Ya no trabaja en la empresa" }
//     ]
//   }
// Each pending_action becomes its own onboarding_requests row (type 'alta'),
// using the matched client's stored email as the requester so it flows
// through the normal admin panel / checklist / update-email machinery. No
// "received" acknowledgment email is sent for these - there's no person who
// submitted a request to acknowledge.
const onboardingImportDir = process.env.ONBOARDING_IMPORT_DIR || null;
const ONBOARDING_IMPORT_CHECK_INTERVAL_MS = 10 * 60 * 1000; // every 10 minutes

const dbRunAsync = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) reject(err); else resolve(this);
  });
});

const dbAllAsync = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err); else resolve(rows);
  });
});

// Returns true if the file was successfully processed (safe to move to
// processed/), false if it should be moved to failed/ for manual review.
const processOnboardingImportFile = async (fileName, payload) => {
  const { service, client, pending_actions: pendingActions } = payload;

  if (!service || !client || !Array.isArray(pendingActions) || pendingActions.length === 0) {
    console.error(`❌ [Onboarding Import] ${fileName}: missing service, client, or pending_actions`);
    return false;
  }

  const matches = await dbAllAsync('SELECT * FROM clients WHERE LOWER(name) = LOWER(?)', [client]);
  const matchedClient = matches[0];
  if (!matchedClient) {
    console.error(`❌ [Onboarding Import] ${fileName}: no client matches "${client}"`);
    return false;
  }
  if (!matchedClient.email) {
    console.error(`❌ [Onboarding Import] ${fileName}: client "${client}" has no email on file`);
    return false;
  }

  const source = `import:${service}`;
  let inserted = 0;

  for (const action of pendingActions) {
    if (!action?.user || !action?.action) continue;

    const details = [
      `Servicio: ${service}`,
      `Acción solicitada: ${action.action}`,
      action.note ? `Nota: ${action.note}` : null,
      payload.generated_at ? `Reporte generado: ${payload.generated_at}` : null,
      payload.reviewed_at ? `Revisado: ${payload.reviewed_at}` : null
    ].filter(Boolean).join('\n');

    await dbRunAsync(
      `INSERT INTO onboarding_requests (manager_email, type, employee_name, details, source)
       VALUES (?, 'alta', ?, ?, ?)`,
      [matchedClient.email, action.user, details, source]
    );
    inserted++;
  }

  if (inserted === 0) {
    console.error(`❌ [Onboarding Import] ${fileName}: no valid pending_actions (each needs user + action)`);
    return false;
  }

  console.log(`✅ [Onboarding Import] ${fileName}: created ${inserted} request(s) for ${client}`);
  return true;
};

let onboardingImportInProgress = false;

const processOnboardingImports = async () => {
  if (!onboardingImportDir || onboardingImportInProgress) return;
  if (!fs.existsSync(onboardingImportDir)) return;

  onboardingImportInProgress = true;
  try {
    const files = fs.readdirSync(onboardingImportDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => entry.name)
      .sort();

    for (const fileName of files) {
      const filePath = path.join(onboardingImportDir, fileName);
      let succeeded = false;

      try {
        const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        succeeded = await processOnboardingImportFile(fileName, payload);
      } catch (err) {
        console.error(`❌ [Onboarding Import] Error processing ${fileName}:`, err.message);
      }

      const destDir = path.join(onboardingImportDir, succeeded ? 'processed' : 'failed');
      try {
        fs.mkdirSync(destDir, { recursive: true });
        fs.renameSync(filePath, path.join(destDir, fileName));
      } catch (moveErr) {
        console.error(`❌ [Onboarding Import] Error moving ${fileName} to ${destDir}:`, moveErr);
      }
    }
  } catch (err) {
    console.error('❌ [Onboarding Import] Error scanning import directory:', err);
  } finally {
    onboardingImportInProgress = false;
  }
};

setTimeout(() => {
  processOnboardingImports();
  setInterval(processOnboardingImports, ONBOARDING_IMPORT_CHECK_INTERVAL_MS);
}, 20 * 1000);

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