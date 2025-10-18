const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? '' // Same origin in production
  : 'http://localhost:3001';

class ApiService {
  private token: string | null = null;

  constructor() {
    // Get token from localStorage
    const session = localStorage.getItem('tasktracker_session');
    if (session) {
      try {
        const sessionData = JSON.parse(atob(session));
        this.token = sessionData.token;
      } catch (error) {
        console.error('Error parsing session:', error);
      }
    }
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}/api${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
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
    }

    return response;
  }

  logout() {
    this.token = null;
    localStorage.removeItem('tasktracker_session');
  }

  // Client methods
  async getClients() {
    return this.request('/clients');
  }

  async createClient(client: any) {
    return this.request('/clients', {
      method: 'POST',
      body: JSON.stringify(client),
    });
  }

  // Project methods
  async getProjects() {
    return this.request('/projects');
  }

  async createProject(project: any) {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(project),
    });
  }

  // Task methods
  async getTasks() {
    return this.request('/tasks');
  }

  async createTask(task: any) {
    return this.request('/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });
  }

  async updateTask(id: string, task: any) {
    return this.request(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(task),
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