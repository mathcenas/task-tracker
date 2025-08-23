import { Client, Project, Task } from '../types';
import { addDays, subDays, format } from 'date-fns';

export function generateSampleData() {
  const today = new Date();
  
  const clients: Omit<Client, 'id'>[] = [
    {
      name: 'Acme Corp',
      hourlyRate: 85,
      contactPerson: 'John Smith',
      email: 'john@acme.com'
    },
    {
      name: 'TechStart Inc',
      hourlyRate: 95,
      contactPerson: 'Sarah Johnson',
      email: 'sarah@techstart.com'
    },
    {
      name: 'Global Solutions',
      hourlyRate: 75,
      contactPerson: 'Mike Wilson',
      email: 'mike@globalsolutions.com'
    }
  ];

  const projects: (Omit<Project, 'id'> & { clientName: string })[] = [
    {
      clientName: 'Acme Corp',
      name: 'Website Redesign',
      description: 'Complete overhaul of company website',
      status: 'active',
      startDate: format(subDays(today, 30), 'yyyy-MM-dd')
    },
    {
      clientName: 'Acme Corp',
      name: 'Mobile App Development',
      description: 'New customer portal mobile app',
      status: 'in-progress',
      startDate: format(subDays(today, 15), 'yyyy-MM-dd')
    },
    {
      clientName: 'TechStart Inc',
      name: 'Cloud Migration',
      description: 'AWS infrastructure setup',
      status: 'active',
      startDate: format(subDays(today, 10), 'yyyy-MM-dd')
    },
    {
      clientName: 'Global Solutions',
      name: 'Security Audit',
      description: 'Annual security review',
      status: 'active',
      startDate: format(subDays(today, 5), 'yyyy-MM-dd')
    }
  ];

  const tasks: (Omit<Task, 'id' | 'clientId' | 'projectId'> & { 
    clientName: string;
    projectName: string;
  })[] = [
    {
      clientName: 'Acme Corp',
      projectName: 'Website Redesign',
      description: 'Homepage wireframes review',
      hours: 3.5,
      date: format(subDays(today, 3), 'yyyy-MM-dd'),
      type: 'request',
      status: 'completed',
      priority: 'high',
      finished: true
    },
    {
      clientName: 'Acme Corp',
      projectName: 'Website Redesign',
      description: 'Server configuration issue',
      hours: 2,
      date: format(subDays(today, 2), 'yyyy-MM-dd'),
      type: 'incident',
      status: 'completed',
      priority: 'high',
      finished: true
    },
    {
      clientName: 'Acme Corp',
      projectName: 'Mobile App Development',
      description: 'UI Component Library',
      hours: 6,
      date: format(subDays(today, 1), 'yyyy-MM-dd'),
      type: 'request',
      status: 'completed',
      priority: 'medium',
      finished: true
    },
    {
      clientName: 'TechStart Inc',
      projectName: 'Cloud Migration',
      description: 'Database migration planning',
      hours: 4,
      date: format(today, 'yyyy-MM-dd'),
      type: 'request',
      status: 'in-progress',
      priority: 'medium',
      finished: false
    },
    {
      clientName: 'Global Solutions',
      projectName: 'Security Audit',
      description: 'Firewall configuration review',
      hours: 3,
      date: format(addDays(today, 1), 'yyyy-MM-dd'),
      type: 'request',
      status: 'pending',
      priority: 'high',
      finished: false
    },
    {
      clientName: 'TechStart Inc',
      projectName: 'Cloud Migration',
      description: 'AWS Reserved Instances',
      type: 'insumos',
      cost: 1200,
      date: format(today, 'yyyy-MM-dd'),
      status: 'completed',
      priority: 'medium',
      finished: true
    }
  ];

  return { clients, projects, tasks };
}