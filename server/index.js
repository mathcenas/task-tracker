import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const { verbose } = sqlite3;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

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
    res.json(clients);
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
      finished: Boolean(task.finished),
      isRecurring: Boolean(task.is_recurring),
      recurringWeekend: Boolean(task.recurring_weekend)
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
    description, hours, cost, date, type, status, priority,
    finished, notes, completedAt, accepted, acceptedAt
  } = req.body;

  db.run(`UPDATE tasks SET
    description = ?, hours = ?, cost = ?, date = ?, type = ?,
    status = ?, priority = ?, finished = ?, notes = ?, completed_at = ?,
    accepted = ?, accepted_at = ?
    WHERE id = ?`,
    [description, hours, cost, date, type, status, priority,
     finished ? 1 : 0, notes, completedAt, accepted ? 1 : 0, acceptedAt, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ success: true });
    }
  );
});

app.delete('/api/tasks/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM tasks WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ success: true });
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
          });
          clientStmt.finalize();

          // Insert projects
          const projectStmt = db.prepare(`INSERT INTO projects
            (id, client_id, name, description, start_date, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`);
          data.projects.forEach(project => {
            projectStmt.run([
              project.id,
              project.client_id,
              project.name,
              project.description || null,
              project.start_date || null,
              project.status || 'active',
              project.created_at
            ]);
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

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('/app/dist'));
  
  app.get('*', (req, res) => {
    res.sendFile('/app/dist/index.html');
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
});