export interface ParsedTask {
  shortId: string;
  description: string;
  hours?: number;
  cost?: number;
  notes?: string;
}

export interface TaskDiff {
  removed: string[];    // shortIds of tasks not present in the imported MD
  modified: Array<{
    shortId: string;
    changes: Partial<{ description: string; hours: number | undefined; cost: number | undefined }>;
  }>;
  unchanged: string[];  // shortIds present and identical
}

function parseTableRows(block: string): Array<Record<string, string>> {
  const lines = block.split('\n').filter(l => l.trim().startsWith('|'));
  if (lines.length < 2) return [];

  const headers = lines[0].split('|').map(h => h.trim().toLowerCase()).filter(Boolean);
  const rows: Array<Record<string, string>> = [];

  for (let i = 2; i < lines.length; i++) {
    const cells = lines[i].split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
    if (cells.length < headers.length) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = cells[idx] ?? ''; });
    rows.push(row);
  }

  return rows;
}

function parseHours(val: string): number | undefined {
  if (!val || val === '—') return undefined;
  const n = parseFloat(val.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? undefined : n;
}

function parseCost(val: string): number | undefined {
  if (!val || val === '—') return undefined;
  const n = parseFloat(val.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? undefined : n;
}

export function parseMarkdownReport(content: string): ParsedTask[] {
  const tasks: ParsedTask[] = [];
  const seen = new Set<string>();

  // Find all markdown tables and parse any row that has an ID column
  const tableBlockRegex = /(\|[^\n]+\|\n\|[-| :]+\|\n(?:\|[^\n]+\|\n?)*)/g;
  let match: RegExpExecArray | null;

  while ((match = tableBlockRegex.exec(content)) !== null) {
    const rows = parseTableRows(match[1]);
    if (rows.length === 0) continue;
    const firstRow = rows[0];
    // Only parse task tables — they must have both 'id' and 'description'.
    // Duplicate Analysis tables have 'id' but no 'description', so skip them.
    if (!('id' in firstRow) || !('description' in firstRow)) continue;

    for (const row of rows) {
      const shortId = row['id']?.trim();
      if (!shortId || shortId.length < 4 || seen.has(shortId)) continue;
      seen.add(shortId);

      const task: ParsedTask = {
        shortId,
        description: row['description']?.replace(/\\\|/g, '|').trim() || '',
      };

      if ('hours' in row) task.hours = parseHours(row['hours']);
      if ('cost' in row) task.cost = parseCost(row['cost']);

      tasks.push(task);
    }
  }

  return tasks;
}

export function diffAgainstOriginal(
  originalTasks: Array<{ id: string; description: string; hours?: number; cost?: number }>,
  parsedTasks: ParsedTask[],
): TaskDiff {
  const parsedMap = new Map(parsedTasks.map(t => [t.shortId, t]));
  const result: TaskDiff = { removed: [], modified: [], unchanged: [] };

  for (const orig of originalTasks) {
    const shortId = orig.id.slice(-8);
    const parsed = parsedMap.get(shortId);

    if (!parsed) {
      result.removed.push(shortId);
      continue;
    }

    const changes: Partial<{ description: string; hours: number | undefined; cost: number | undefined }> = {};

    if (parsed.description && parsed.description !== orig.description) {
      changes.description = parsed.description;
    }
    if ('hours' in parsed && parsed.hours !== orig.hours) {
      changes.hours = parsed.hours;
    }
    if ('cost' in parsed && parsed.cost !== orig.cost) {
      changes.cost = parsed.cost;
    }

    if (Object.keys(changes).length > 0) {
      result.modified.push({ shortId, changes });
    } else {
      result.unchanged.push(shortId);
    }
  }

  return result;
}
