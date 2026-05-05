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
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add any existing headers
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        headers[key] = String(value);
      });
    }

    // Add Authorization header if token exists
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    console.log('🌐 [ApiService] Making request:', {
      method: options.method || 'GET',
      url,
      token: this.token || 'NO TOKEN',
      hasAuth: !!this.token,
      headers: headers,
      body: options.body ? JSON.parse(options.body as string) : undefined
    });

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
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
      createdAt: c.created_at,
      archived: Boolean(c.archived),
      yearlyRates: c.yearly_rates?.map((r: any) => ({
        id: r.id,
        clientId: r.client_id,
        year: r.year,
        hourlyRate: r.hourly_rate,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      })) || []
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

  async archiveClient(id: string, archived: boolean) {
    return this.request(`/clients/${id}/archive`, {
      method: 'PATCH',
      body: JSON.stringify({ archived }),
    });
  }

  async updateClient(id: string, client: any) {
    const payload = {
      name: client.name,
      slug: client.slug,
      hourlyRate: client.hourlyRate,
      contactPerson: client.contactPerson,
      email: client.email,
      phone: client.phone
    };
    return this.request(`/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async deleteClient(id: string) {
    return this.request(`/clients/${id}`, {
      method: 'DELETE',
    });
  }

  // Client Yearly Rates methods
  async getClientYearlyRates(clientId: string) {
    const rates = await this.request(`/clients/${clientId}/yearly-rates`);
    return rates.map((r: any) => ({
      id: r.id,
      clientId: r.client_id,
      year: r.year,
      hourlyRate: r.hourly_rate,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  async saveClientYearlyRate(clientId: string, rate: any) {
    const payload = {
      id: rate.id,
      year: rate.year,
      hourlyRate: rate.hourlyRate
    };
    return this.request(`/clients/${clientId}/yearly-rates`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async deleteClientYearlyRate(clientId: string, rateId: string) {
    return this.request(`/clients/${clientId}/yearly-rates/${rateId}`, {
      method: 'DELETE',
    });
  }

  async updateProject(id: string, project: any) {
    const payload = {
      clientId: project.clientId,
      name: project.name,
      description: project.description,
      startDate: project.startDate,
      status: project.status
    };
    return this.request(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async deleteProject(id: string) {
    return this.request(`/projects/${id}`, {
      method: 'DELETE',
    });
  }

  // Task methods
  async getTasks() {
    const tasks = await this.request('/tasks');
    return tasks.map((t: any) => ({
      id: t.id,
      clientId: t.clientId || t.client_id,
      projectId: t.projectId || t.project_id,
      description: t.description,
      hours: t.hours,
      cost: t.cost,
      date: t.date,
      type: t.type,
      status: t.status,
      priority: t.priority,
      finished: Boolean(t.finished),
      notes: t.notes,
      completedAt: t.completed_at || t.completedAt,
      assignedTo: t.assigned_to || t.assignedTo,
      isRecurring: Boolean(t.is_recurring ?? t.isRecurring),
      recurringDay: t.recurring_day ?? t.recurringDay,
      recurringWeekend: Boolean(t.recurring_weekend ?? t.recurringWeekend),
      recurringWeekendType: t.recurring_weekend_type || t.recurringWeekendType,
      recurringWeekendDay: t.recurring_weekend_day || t.recurringWeekendDay,
      recurringEndDate: t.recurring_end_date || t.recurringEndDate,
      accepted: Boolean(t.accepted),
      acceptedAt: t.accepted_at || t.acceptedAt,
      createdAt: t.created_at || t.createdAt,
      billed: Boolean(t.billed),
      billedAt: t.billed_at || t.billedAt,
      paid: Boolean(t.paid),
      paidAt: t.paid_at || t.paidAt,
      invoiceNumber: t.invoice_number || t.invoiceNumber,
      vendor: t.vendor,
      approvedBy: t.approved_by || t.approvedBy,
      receiptRef: t.receipt_ref || t.receiptRef,
      approvalStatus: t.approval_status || t.approvalStatus || 'pending',
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
      recurringEndDate: task.recurringEndDate,
      accepted: task.accepted,
      acceptedAt: task.acceptedAt
    };
    console.log('📤 [ApiService] createTask payload:', payload);
    return this.request('/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateTask(id: string, task: any) {
    const payload = {
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
      accepted: task.accepted,
      acceptedAt: task.acceptedAt,
      isRecurring: task.isRecurring,
      billed: task.billed,
      billedAt: task.billedAt,
      paid: task.paid,
      paidAt: task.paidAt,
      invoiceNumber: task.invoiceNumber,
      approvedBy: task.approvedBy,
      vendor: task.vendor,
      receiptRef: task.receiptRef,
      approvalStatus: task.approvalStatus
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

  // Recurring Tasks methods
  async getRecurringTasks() {
    const tasks = await this.request('/recurring-tasks');
    return tasks.map((t: any) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      type: t.type,
      priority: t.priority,
      clientId: t.client_id,
      projectId: t.project_id,
      dayOfMonth: t.day_of_month,
      estimatedHours: t.estimated_hours,
      estimatedCost: t.estimated_cost,
      isActive: Boolean(t.is_active),
      lastGenerated: t.last_generated,
      nextDue: t.next_due,
      recurringStartDate: t.recurring_start_date,
      recurringWeekend: Boolean(t.recurring_weekend),
      recurringWeekendType: t.recurring_weekend_type,
      recurringWeekendDay: t.recurring_weekend_day,
      recurringEndDate: t.recurring_end_date,
      createdAt: t.created_at
    }));
  }

  async createRecurringTask(task: any) {
    const payload = {
      id: task.id,
      name: task.name,
      description: task.description,
      type: task.type,
      priority: task.priority,
      clientId: task.clientId,
      projectId: task.projectId,
      dayOfMonth: task.dayOfMonth,
      estimatedHours: task.estimatedHours,
      estimatedCost: task.estimatedCost,
      isActive: task.isActive,
      nextDue: task.nextDue,
      recurringStartDate: task.recurringStartDate,
      recurringWeekend: task.recurringWeekend,
      recurringWeekendType: task.recurringWeekendType,
      recurringWeekendDay: task.recurringWeekendDay,
      recurringEndDate: task.recurringEndDate
    };
    return this.request('/recurring-tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateRecurringTask(id: string, task: any) {
    const payload = {
      name: task.name,
      description: task.description,
      type: task.type,
      priority: task.priority,
      clientId: task.clientId,
      projectId: task.projectId,
      dayOfMonth: task.dayOfMonth,
      estimatedHours: task.estimatedHours,
      estimatedCost: task.estimatedCost,
      isActive: task.isActive,
      lastGenerated: task.lastGenerated,
      nextDue: task.nextDue,
      recurringStartDate: task.recurringStartDate,
      recurringWeekend: task.recurringWeekend,
      recurringWeekendType: task.recurringWeekendType,
      recurringWeekendDay: task.recurringWeekendDay,
      recurringEndDate: task.recurringEndDate
    };
    return this.request(`/recurring-tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async deleteRecurringTask(id: string) {
    return this.request(`/recurring-tasks/${id}`, {
      method: 'DELETE',
    });
  }

  // Task Templates methods
  async getTaskTemplates() {
    const templates = await this.request('/task-templates');
    return templates.map((t: any) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      type: t.type,
      priority: t.priority,
      clientId: t.client_id,
      projectId: t.project_id,
      estimatedHours: t.estimated_hours,
      estimatedCost: t.estimated_cost,
      tags: t.tags,
      createdAt: t.created_at
    }));
  }

  async createTaskTemplate(template: any) {
    const payload = {
      id: template.id,
      name: template.name,
      description: template.description,
      type: template.type,
      priority: template.priority,
      clientId: template.clientId,
      projectId: template.projectId,
      estimatedHours: template.estimatedHours,
      estimatedCost: template.estimatedCost,
      tags: template.tags
    };
    return this.request('/task-templates', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateTaskTemplate(id: string, template: any) {
    const payload = {
      name: template.name,
      description: template.description,
      type: template.type,
      priority: template.priority,
      clientId: template.clientId,
      projectId: template.projectId,
      estimatedHours: template.estimatedHours,
      estimatedCost: template.estimatedCost,
      tags: template.tags
    };
    return this.request(`/task-templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async deleteTaskTemplate(id: string) {
    return this.request(`/task-templates/${id}`, {
      method: 'DELETE',
    });
  }

  // Backup & Restore
  async exportBackup() {
    console.log('📦 [ApiService] Exporting database backup...');
    return this.request('/backup');
  }

  async importBackup(backupData: any) {
    console.log('📥 [ApiService] Importing database backup...');
    return this.request('/restore', {
      method: 'POST',
      body: JSON.stringify(backupData),
    });
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }

  // Uptime Kuma Integration
  async getUptimeKumaConfig() {
    return this.request('/uptime-kuma/config');
  }

  async saveUptimeKumaConfig(config: any) {
    return this.request('/uptime-kuma/config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async getUptimeKumaStatus() {
    return this.request('/uptime-kuma/status');
  }

  async connectUptimeKuma() {
    return this.request('/uptime-kuma/connect', {
      method: 'POST',
    });
  }

  async disconnectUptimeKuma() {
    return this.request('/uptime-kuma/disconnect', {
      method: 'POST',
    });
  }

  // Status Pages
  async getStatusPages() {
    return this.request('/status-pages');
  }

  async createStatusPage(data: any) {
    return this.request('/status-pages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateStatusPage(id: string, data: any) {
    return this.request(`/status-pages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteStatusPage(id: string) {
    return this.request(`/status-pages/${id}`, {
      method: 'DELETE',
    });
  }

  // Monitor Mappings
  async getMonitorMappings() {
    return this.request('/monitor-mappings');
  }

  async saveMonitorMappings(mappings: any[]) {
    return this.request('/monitor-mappings', {
      method: 'POST',
      body: JSON.stringify(mappings),
    });
  }

  // Monitor Feeds
  async getMonitorFeeds() {
    return this.request('/monitor-feeds');
  }

  async createMonitorFeed(data: any) {
    return this.request('/monitor-feeds', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMonitorFeed(id: string, data: any) {
    return this.request(`/monitor-feeds/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteMonitorFeed(id: string) {
    return this.request(`/monitor-feeds/${id}`, {
      method: 'DELETE',
    });
  }

  // Activity Logs
  async getActivityLogs(limit: number = 100, offset: number = 0) {
    return this.request(`/activity-logs?limit=${limit}&offset=${offset}`);
  }

  // Company Settings
  async getCompanySettings() {
    return this.request('/company-settings');
  }

  async saveCompanySettings(settings: any) {
    return this.request('/company-settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }

  // Quotes
  async getQuotes() {
    return this.request('/quotes');
  }

  async getQuote(id: string) {
    return this.request(`/quotes/${id}`);
  }

  async createQuote(quote: any) {
    return this.request('/quotes', {
      method: 'POST',
      body: JSON.stringify(quote),
    });
  }

  async updateQuote(id: string, quote: any) {
    return this.request(`/quotes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(quote),
    });
  }

  async deleteQuote(id: string) {
    return this.request(`/quotes/${id}`, {
      method: 'DELETE',
    });
  }

  async getStats(): Promise<{ tasks: number; clients: number; projects: number; recurring: number; total: number }> {
    return this.request('/stats');
  }
}

export const apiService = new ApiService();
export const api = apiService;