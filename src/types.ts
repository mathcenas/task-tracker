export interface Client {
  id: string;
  name: string;
  slug: string;
  hourlyRate: number;
  contactPerson?: string;
  email?: string;
  phone?: string;
  archived?: boolean;
  yearlyRates?: ClientYearlyRate[];
}

export interface ClientYearlyRate {
  id: string;
  clientId: string;
  year: number;
  hourlyRate: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface OnboardingRequest {
  id: number;
  managerEmail: string;
  type: 'alta' | 'baja';
  employeeName: string;
  role?: string;
  effectiveDate?: string;
  details?: string;
  status: 'pending' | 'completed';
  createdAt?: string;
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
  status: 'not_started' | 'in_progress' | 'review' | 'completed';
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
  recurringEndDate?: string; // End date for recurring tasks
  accepted?: boolean; // Whether the recurring task has been accepted
  acceptedAt?: string; // When the recurring task was accepted
  createdAt?: string;
  billed?: boolean;
  billedAt?: string;
  paid?: boolean;
  paidAt?: string;
  invoiceNumber?: string;
  approvedBy?: string;
  vendor?: string;
  receiptRef?: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
}