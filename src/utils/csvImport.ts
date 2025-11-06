import { Task } from '../types';

interface CSVRow {
  Date: string;
  Duration: string;
  Price: string;
  User: string;
  'E-mail': string;
  'Staff number': string;
  Customer: string;
  Activity: string;
  Description: string;
  'VAT-ID': string;
  'Order number': string;
}

// Map activity types from old system to TaskTracker types
const activityTypeMap: Record<string, 'incident' | 'request' | 'insumos'> = {
  'Incidentes IT': 'incident',
  'Solicitudes IT': 'request',
  'Gestión de Servicios IT': 'request',
  'Consultoría IT - 2024': 'request',
  'Consultoría IT': 'request',
  'Adquisiciones': 'insumos'
};

// Convert duration string (H:MM) to decimal hours
function parseDuration(duration: string): number {
  if (!duration || duration === '0:00') return 0;

  const parts = duration.split(':');
  if (parts.length !== 2) return 0;

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  return hours + (minutes / 60);
}

// Parse date in M/D/YYYY format
function parseDate(dateStr: string): string {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return new Date().toISOString().split('T')[0];

  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  const date = new Date(year, month - 1, day);
  return date.toISOString().split('T')[0];
}

// Parse CSV content
export function parseCSV(csvContent: string): CSVRow[] {
  const lines = csvContent.split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',');
    const row: any = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ? values[index].trim() : '';
    });

    rows.push(row as CSVRow);
  }

  return rows;
}

// Transform CSV rows to TaskTracker tasks
export function transformCSVToTasks(
  rows: CSVRow[],
  clientId: string,
  projectId?: string
): Partial<Task>[] {
  return rows
    .filter(row => row.Customer && row.Activity && row.Date)
    .map((row, index) => {
      const hours = parseDuration(row.Duration);
      const cost = parseFloat(row.Price) || 0;
      const type = activityTypeMap[row.Activity] || 'request';

      // For supplies (insumos), hours should be 0
      const finalHours = type === 'insumos' ? 0 : hours;

      return {
        id: `import-${Date.now()}-${index}`,
        clientId,
        projectId: projectId || '',
        title: row.Activity,
        description: row.Description || '',
        date: parseDate(row.Date),
        type,
        hours: finalHours,
        cost,
        finished: true,
        status: 'completed'
      };
    });
}

// Generate import summary
export function generateImportSummary(tasks: Partial<Task>[]): string {
  const incidents = tasks.filter(t => t.type === 'incident').length;
  const requests = tasks.filter(t => t.type === 'request').length;
  const supplies = tasks.filter(t => t.type === 'insumos').length;

  const totalHours = tasks
    .filter(t => t.type !== 'insumos')
    .reduce((sum, t) => sum + (t.hours || 0), 0);

  const totalCost = tasks.reduce((sum, t) => sum + (t.cost || 0), 0);

  return `
Import Summary:
- Total Tasks: ${tasks.length}
- Incidents: ${incidents}
- Requests: ${requests}
- Supplies: ${supplies}
- Total Hours: ${totalHours.toFixed(2)}
- Total Cost: $${totalCost.toFixed(2)}
  `.trim();
}
