const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? '' // Same origin in production
  : 'http://localhost:3000';

class ApiService {
  private token: string | null = null;

  constructor() {
    this.loadToken();
  }

  private loadToken() {
    // Get token from localStorage
    const session = localStorage.getItem('tasktracker_session');
    if (session) {
      try {
        const sessionData = JSON.parse(atob(session));
        this.token = sessionData.token;
        console.log('🔑 [ApiService] Token loaded:', this.token ? 'present' : 'missing');
      } catch (error) {
        console.error('❌ [ApiService] Error parsing session:', error);
        this.token = null;
      }
    } else {
      console.log('⚠️ [ApiService] No session found in localStorage');
      this.token = null;
    }
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    // Reload token before each request to ensure we have the latest
    this.loadToken();

    const url = `${API_BASE_URL}/api${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    console.log('🌐 [ApiService] Making request:', {
      method: options.method || 'GET',
      url,
      token: this.token || 'NO TOKEN',
      hasAuth: !!this.token,
      body: options.body ? JSON.parse(options.body as string) : undefined
    });

    const response = await fetch(url, {
      ...options,
      headers,
    });

    console.log('📥 [ApiService] Response received:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      console.error('❌ [ApiService] Request failed:', error);
      throw new Error(error.error || 'Request failed');
    }

    const data = await response.json();
    console.log('✅ [ApiService] Request successful:', data);
    return data;
  }

  // Auth methods
  async login(username: string, password: string) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    if (response.success) {
      this.token = response.token;

      // Store session
      const sessionData = {
        token: response.token,
        userId: response.user.id,
        username: response.user.username,
        role: response.user.role,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      };

      localStorage.setItem('tasktracker_session', btoa(JSON.stringify(sessionData)));
      console.log('✅ [ApiService] Login successful, token stored:', response.token);
    }

    return response;
  }

  logout() {
    this.token = null;
    localStorage.removeItem('tasktracker_session');
  }

  // Client methods
  async getClients() {
    const clients = await this.request('/clients');
    return clients.map((c: any) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      hourlyRate: c.hourly_rate,
      contactPerson: c.contact_person,
      email: c.email,
      phone: c.phone,
      createdAt: c.created_at
    }));
  }

  async createClient(client: any) {
    const payload = {
      id: client.id,
      name: client.name,
      slug: client.slug,
      hourlyRate: client.hourlyRate,
      contactPerson: client.contactPerson,
      email: client.email,
      phone: client.phone
    };
    console.log('📤 [ApiService] createClient payload:', payload);
    return this.request('/clients', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Project methods
  async getProjects() {
    const projects = await this.request('/projects');
    return projects.map((p: any) => ({
      id: p.id,
      clientId: p.client_id,
      name: p.name,
      description: p.description,
      startDate: p.start_date,
      status: p.status,
      createdAt: p.created_at
    }));
  }

  async createProject(project: any) {
    const payload = {
      id: project.id,
      clientId: project.clientId,
      name: project.name,
      description: project.description,
      startDate: project.startDate,
      status: project.status
    };
    console.log('📤 [ApiService] createProject payload:', payload);
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Task methods
  async getTasks() {
    const tasks = await this.request('/tasks');
    return tasks.map((t: any) => ({
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
      assignedTo: t.assigned_to,
      isRecurring: Boolean(t.is_recurring),
      recurringDay: t.recurring_day,
      recurringWeekend: Boolean(t.recurring_weekend),
      recurringWeekendType: t.recurring_weekend_type,
      recurringWeekendDay: t.recurring_weekend_day,
      recurringEndDate: t.recurring_end_date,
      createdAt: t.created_at
    }));
  }

  async createTask(task: any) {
    const payload = {
      id: task.id,
      clientId: task.clientId,
      projectId: task.projectId,
      description: task.description,
      hours: task.hours,
      cost: task.cost,
      date: task.date,
      type: task.type,
      status: task.status,
      priority: task.priority,
      finished: task.finished,
      notes: task.notes,
      completedAt: task.completedAt,
      assignedTo: task.assignedTo,
      isRecurring: task.isRecurring,
      recurringDay: task.recurringDay,
      recurringWeekend: task.recurringWeekend,
      recurringWeekendType: task.recurringWeekendType,
      recurringWeekendDay: task.recurringWeekendDay,
      recurringEndDate: task.recurringEndDate
    };
    console.log('📤 [ApiService] createTask payload:', payload);
    return this.request('/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateTask(id: string, task: any) {
    const payload = {
      description: task.description,
      hours: task.hours,
      cost: task.cost,
      date: task.date,
      type: task.type,
      status: task.status,
      priority: task.priority,
      finished: task.finished,
      notes: task.notes,
      completedAt: task.completedAt
    };
    return this.request(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async deleteTask(id: string) {
    return this.request(`/tasks/${id}`, {
      method: 'DELETE',
    });
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }
}

export const apiService = new ApiService();