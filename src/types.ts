export interface Client {
  id: string;
  name: string;
  slug: string;
  hourlyRate: number;
  contactPerson?: string;
  email?: string;
  phone?: string;
}

export interface Project {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  startDate?: string;
  status: 'active' | 'completed' | 'on-hold';
}

export interface Task {
  id: string;
  clientId: string;
  projectId: string;
  description: string;
  hours?: number;
  cost?: number;
  date: string;
  type: 'incident' | 'request' | 'insumos';
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  finished: boolean;
  notes?: string;
  completedAt?: string;
  assignedTo?: string;
  isRecurring?: boolean;
  recurringDay?: number; // Day of the month for recurring tasks
  recurringWeekend?: boolean; // Whether this is a weekend-based recurring task
  recurringWeekendType?: 'first' | 'second' | 'third' | 'fourth' | 'last'; // Which weekend of the month
  recurringWeekendDay?: 'saturday' | 'sunday'; // Which day of the weekend
  createdAt?: string;
}