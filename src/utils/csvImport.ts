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

const activityTypeMap: Record<string, 'incident' | 'request' | 'insumos'> = {
  'Incidentes IT': 'incident',
  'Solicitudes IT': 'request',
  'Gestión de Servicios IT': 'request',
  'Consultoría IT - 2024': 'request',
  'Consultoría IT': 'request',
  'Consultoría IT - 28': 'request',
  'Consultoría Web': 'request',
  'Adquisiciones': 'insumos'
};

function parseDuration(duration: string): number {
  if (!duration || duration === '0:00') return 0;

  const parts = duration.split(':');
  if (parts.length !== 2) return 0;

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  return hours + (minutes / 60);
}

function parseDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];

  dateStr = dateStr.trim();

  // Try ISO format first: YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(n => parseInt(n, 10));
    const date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  // Try MM/DD/YYYY (American format)
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
    const [month, day, year] = dateStr.split('/').map(n => parseInt(n, 10));
    const date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  // Try DD/MM/YYYY (European format)
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
    const parts = dateStr.split('/').map(n => parseInt(n, 10));
    // Heuristic: if first number > 12, it's likely DD/MM/YYYY
    if (parts[0] > 12) {
      const [day, month, year] = parts;
      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }

  // Try YYYY/MM/DD
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('/').map(n => parseInt(n, 10));
    const date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  // Try DD-MM-YYYY
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateStr)) {
    const parts = dateStr.split('-').map(n => parseInt(n, 10));
    if (parts[0] > 12) {
      const [day, month, year] = parts;
      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }

  console.warn(`Could not parse date: ${dateStr}, using current date`);
  return new Date().toISOString().split('T')[0];
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

export function parseCSV(csvContent: string): CSVRow[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const row: any = {};

    headers.forEach((header, index) => {
      const value = values[index] || '';
      row[header] = value.replace(/^"|"$/g, '').trim();
    });

    rows.push(row as CSVRow);
  }

  return rows;
}

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

      const finalHours = type === 'insumos' ? 0 : hours;

      const taskDescription = row.Description ?
        `${row.Activity}\n${row.Description}` :
        row.Activity;

      return {
        id: `import-${Date.now()}-${index}`,
        clientId,
        projectId: projectId || '',
        description: taskDescription,
        date: parseDate(row.Date),
        type,
        hours: finalHours,
        cost,
        priority: 'medium',
        finished: true,
        status: 'completed'
      };
    });
}

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
