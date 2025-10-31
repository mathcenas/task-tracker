import { Task, Client, Project } from '../types';
import { format, parseISO } from 'date-fns';

interface ExportTask extends Task {
  clientName?: string;
  projectName?: string;
}

export function exportTasksToCSV(
  tasks: Task[],
  getClient: (id: string) => Client | undefined,
  getProject: (id: string) => Project | undefined,
  filename: string = 'tasks-export.csv'
) {
  const enrichedTasks: ExportTask[] = tasks.map(task => {
    const client = getClient(task.clientId);
    const project = getProject(task.projectId);

    return {
      ...task,
      clientName: client?.name || 'Unknown',
      projectName: project?.name || 'Unknown'
    };
  });

  const headers = [
    'Date',
    'Client',
    'Project',
    'Description',
    'Type',
    'Status',
    'Priority',
    'Hours',
    'Cost',
    'Finished',
    'Notes',
    'Completed At'
  ];

  const rows = enrichedTasks.map(task => {
    const taskDate = parseISO(task.date + 'T00:00:00');

    return [
      format(taskDate, 'yyyy-MM-dd'),
      escapeCSV(task.clientName || ''),
      escapeCSV(task.projectName || ''),
      escapeCSV(task.description),
      task.type,
      formatStatus(task.status),
      task.priority,
      task.hours?.toString() || '',
      task.cost?.toString() || '',
      task.finished ? 'Yes' : 'No',
      escapeCSV(task.notes || ''),
      task.completedAt ? format(parseISO(task.completedAt), 'yyyy-MM-dd HH:mm') : ''
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  downloadCSV(csvContent, filename);
}

export function exportMonthlyReportToCSV(
  tasks: Task[],
  getClient: (id: string) => Client | undefined,
  getProject: (id: string) => Project | undefined,
  clientName: string,
  month: string,
  filename?: string
) {
  const enrichedTasks: ExportTask[] = tasks.map(task => {
    const client = getClient(task.clientId);
    const project = getProject(task.projectId);

    return {
      ...task,
      clientName: client?.name || 'Unknown',
      projectName: project?.name || 'Unknown'
    };
  });

  const headers = [
    'Date',
    'Project',
    'Description',
    'Type',
    'Status',
    'Priority',
    'Hours',
    'Cost',
    'Notes'
  ];

  const rows = enrichedTasks.map(task => {
    const taskDate = parseISO(task.date + 'T00:00:00');

    return [
      format(taskDate, 'yyyy-MM-dd'),
      escapeCSV(task.projectName || ''),
      escapeCSV(task.description),
      task.type,
      formatStatus(task.status),
      task.priority,
      task.hours?.toString() || '',
      task.cost?.toString() || '',
      escapeCSV(task.notes || '')
    ];
  });

  const totalHours = tasks.reduce((sum, task) => sum + (task.hours || 0), 0);
  const totalCost = tasks.reduce((sum, task) => sum + (task.cost || 0), 0);

  const csvContent = [
    `Monthly Report - ${clientName}`,
    `Period: ${month}`,
    '',
    headers.join(','),
    ...rows.map(row => row.join(',')),
    '',
    `Total Hours:,${totalHours}`,
    `Total Cost:,${totalCost.toFixed(2)}`
  ].join('\n');

  const defaultFilename = `${clientName.replace(/\s+/g, '-')}-${month}-report.csv`;
  downloadCSV(csvContent, filename || defaultFilename);
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'not_started': 'Not Started',
    'in_progress': 'In Progress',
    'review': 'Review',
    'completed': 'Completed'
  };
  return statusMap[status] || status;
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
