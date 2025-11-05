import { io } from 'socket.io-client';

class UptimeKumaService {
  constructor(db) {
    this.db = db;
    this.socket = null;
    this.isConnected = false;
    this.config = {
      enabled: false,
      url: '',
      username: '',
      password: '',
      createTasksOnDown: true,
      createTasksOnUp: false,
      autoAssignClient: null,
      autoAssignProject: null,
      minDowntimeSeconds: 0
    };
    this.monitors = new Map();
    this.lastHeartbeats = new Map();
  }

  async loadConfig() {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM uptime_kuma_config WHERE id = 1',
        (err, row) => {
          if (err) {
            console.error('Error loading Uptime Kuma config:', err);
            reject(err);
            return;
          }
          if (row) {
            this.config = {
              enabled: row.enabled === 1,
              url: row.url,
              username: row.username,
              password: row.password,
              createTasksOnDown: row.create_tasks_on_down === 1,
              createTasksOnUp: row.create_tasks_on_up === 1,
              autoAssignClient: row.auto_assign_client,
              autoAssignProject: row.auto_assign_project,
              minDowntimeSeconds: row.min_downtime_seconds || 0
            };
          }
          resolve(this.config);
        }
      );
    });
  }

  async saveConfig(config) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO uptime_kuma_config
         (id, enabled, url, username, password, create_tasks_on_down, create_tasks_on_up,
          auto_assign_client, auto_assign_project, min_downtime_seconds)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          config.enabled ? 1 : 0,
          config.url,
          config.username,
          config.password,
          config.createTasksOnDown ? 1 : 0,
          config.createTasksOnUp ? 1 : 0,
          config.autoAssignClient,
          config.autoAssignProject,
          config.minDowntimeSeconds || 0
        ],
        (err) => {
          if (err) {
            console.error('Error saving Uptime Kuma config:', err);
            reject(err);
            return;
          }
          this.config = config;
          resolve();
        }
      );
    });
  }

  async connect() {
    if (this.socket?.connected) {
      console.log('Already connected to Uptime Kuma');
      return;
    }

    await this.loadConfig();

    if (!this.config.enabled || !this.config.url) {
      console.log('Uptime Kuma integration disabled or not configured');
      return;
    }

    console.log(`🔌 Connecting to Uptime Kuma at ${this.config.url}...`);

    try {
      this.socket = io(this.config.url, {
        reconnection: true,
        reconnectionDelay: 5000,
        reconnectionDelayMax: 30000,
        timeout: 10000
      });

      this.setupEventHandlers();
    } catch (error) {
      console.error('❌ Failed to connect to Uptime Kuma:', error);
    }
  }

  setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('✅ Connected to Uptime Kuma');
      this.isConnected = true;

      if (this.config.username && this.config.password) {
        console.log('🔐 Logging in to Uptime Kuma...');
        this.socket.emit('login', {
          username: this.config.username,
          password: this.config.password,
          token: ''
        }, (response) => {
          if (response.ok) {
            console.log('✅ Logged in to Uptime Kuma successfully');
          } else {
            console.error('❌ Failed to login:', response.msg);
          }
        });
      }
    });

    this.socket.on('disconnect', () => {
      console.log('⚠️ Disconnected from Uptime Kuma');
      this.isConnected = false;
    });

    this.socket.on('monitorList', (monitors) => {
      console.log(`📊 Received ${Object.keys(monitors).length} monitors from Uptime Kuma`);
      Object.entries(monitors).forEach(([id, monitor]) => {
        this.monitors.set(parseInt(id), monitor);
      });
    });

    this.socket.on('heartbeat', (heartbeat) => {
      this.handleHeartbeat(heartbeat);
    });

    this.socket.on('heartbeatList', (monitorId, heartbeats) => {
      console.log(`💓 Received ${heartbeats.length} heartbeats for monitor ${monitorId}`);
      if (heartbeats.length > 0) {
        const latestHeartbeat = heartbeats[heartbeats.length - 1];
        this.handleHeartbeat(latestHeartbeat);
      }
    });

    this.socket.on('info', (info) => {
      console.log('ℹ️ Uptime Kuma info:', info);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error.message);
    });
  }

  async handleHeartbeat(heartbeat) {
    const monitorId = heartbeat.monitorID;
    const monitor = this.monitors.get(monitorId);

    if (!monitor) {
      return;
    }

    const lastHeartbeat = this.lastHeartbeats.get(monitorId);
    const isStatusChange = heartbeat.important;
    const isDown = heartbeat.status === 0;
    const isUp = heartbeat.status === 1;

    console.log(`💓 Heartbeat for "${monitor.name}": ${isDown ? 'DOWN' : isUp ? 'UP' : 'PENDING'} (${heartbeat.msg})`);

    this.lastHeartbeats.set(monitorId, heartbeat);

    // Check if we should create a task
    if (isStatusChange) {
      if (isDown && this.config.createTasksOnDown) {
        // Check minimum downtime
        if (this.config.minDowntimeSeconds > 0 && heartbeat.duration < this.config.minDowntimeSeconds) {
          console.log(`⏭️ Skipping task creation - downtime ${heartbeat.duration}s < minimum ${this.config.minDowntimeSeconds}s`);
          return;
        }

        await this.createIncidentTask(monitor, heartbeat, 'down');
      } else if (isUp && this.config.createTasksOnUp && lastHeartbeat?.status === 0) {
        await this.createIncidentTask(monitor, heartbeat, 'recovery');
      }
    }
  }

  async createIncidentTask(monitor, heartbeat, type) {
    const isDown = type === 'down';
    const description = isDown
      ? `🚨 INCIDENT: ${monitor.name} is DOWN - ${heartbeat.msg}`
      : `✅ RECOVERY: ${monitor.name} is back UP`;

    const tags = monitor.tags?.map(t => t.name).join(', ') || '';
    const url = monitor.url || monitor.hostname || '';

    const notes = `
Monitor: ${monitor.name}
Type: ${monitor.type}
URL: ${url}
Status: ${isDown ? 'DOWN' : 'UP'}
Message: ${heartbeat.msg}
Time: ${heartbeat.localDateTime} (${heartbeat.timezone})
${heartbeat.ping ? `Response Time: ${heartbeat.ping}ms` : ''}
${tags ? `Tags: ${tags}` : ''}
${monitor.accepted_statuscodes_json ? `Expected Status Codes: ${monitor.accepted_statuscodes_json}` : ''}
    `.trim();

    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      this.db.run(
        `INSERT INTO tasks
         (id, description, notes, type, priority, status, client_id, project_id, created_at, updated_at, due_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          taskId,
          description,
          notes,
          'incident',
          isDown ? 'high' : 'low',
          isDown ? 'not_started' : 'completed',
          this.config.autoAssignClient,
          this.config.autoAssignProject,
          now,
          now,
          isDown ? now : null
        ],
        (err) => {
          if (err) {
            console.error('❌ Error creating incident task:', err);
            reject(err);
            return;
          }
          console.log(`✅ Created ${type} task for "${monitor.name}"`);
          resolve(taskId);
        }
      );
    });
  }

  disconnect() {
    if (this.socket) {
      console.log('🔌 Disconnecting from Uptime Kuma...');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.monitors.clear();
      this.lastHeartbeats.clear();
    }
  }

  async reconnect() {
    this.disconnect();
    await this.connect();
  }

  getStatus() {
    return {
      connected: this.isConnected,
      config: {
        enabled: this.config.enabled,
        url: this.config.url,
        hasCredentials: !!(this.config.username && this.config.password)
      },
      monitors: this.monitors.size,
      lastHeartbeats: this.lastHeartbeats.size
    };
  }
}

export default UptimeKumaService;
