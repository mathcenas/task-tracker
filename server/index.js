const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
const dbPath = process.env.NODE_ENV === 'production' 
  ? '/app/data/tasktracker.db' 
  : path.join(__dirname, 'tasktracker.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
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
      status TEXT NOT NULL DEFAULT 'pending',
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

  // Create default admin user
  const adminPassword = bcrypt.hashSync('TaskTracker2025!', 10);
  const userPassword = bcrypt.hashSync('User2025!', 10);
  
  db.run(`INSERT OR IGNORE INTO users (id, username, password_hash, email, role) VALUES 
    ('admin-1', 'admin', ?, 'admin@tasktracker.pro', 'admin'),
    ('user-1', 'user', ?, 'user@tasktracker.pro', 'user')`, 
    [adminPassword, userPassword]);
};

initDB();

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Simple token validation (in production, use JWT)
  if (token === 'demo-token') {
    req.user = { id: 'admin-1', role: 'admin' };
    next();
  } else {
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
  
  db.run(`INSERT INTO clients (id, name, slug, hourly_rate, contact_person, email, phone) 
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, name, slug, hourlyRate, contactPerson, email, phone],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ success: true, id });
    }
  );
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
    recurringWeekendDay, recurringEndDate
  } = req.body;
  
  db.run(`INSERT INTO tasks (
    id, client_id, project_id, description, hours, cost, date, type,
    status, priority, finished, notes, completed_at, assigned_to,
    is_recurring, recurring_day, recurring_weekend, recurring_weekend_type,
    recurring_weekend_day, recurring_end_date
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, clientId, projectId, description, hours, cost, date, type,
      status, priority, finished ? 1 : 0, notes, completedAt, assignedTo,
      isRecurring ? 1 : 0, recurringDay, recurringWeekend ? 1 : 0, 
      recurringWeekendType, recurringWeekendDay, recurringEndDate
    ],
    function(err) {
      if (err) {
        console.error('Error inserting task:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ success: true, id });
    }
  );
});

app.put('/api/tasks/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { 
    description, hours, cost, date, type, status, priority, 
    finished, notes, completedAt
  } = req.body;
  
  db.run(`UPDATE tasks SET 
    description = ?, hours = ?, cost = ?, date = ?, type = ?,
    status = ?, priority = ?, finished = ?, notes = ?, completed_at = ?
    WHERE id = ?`,
    [description, hours, cost, date, type, status, priority, 
     finished ? 1 : 0, notes, completedAt, id],
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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