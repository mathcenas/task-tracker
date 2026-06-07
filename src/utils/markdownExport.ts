import { format, parseISO } from 'date-fns';

interface Task {
  id: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  date: string;
  hours?: number;
  cost?: number;
  finished: boolean;
  projectId: string;
  clientId: string;
  notes?: string;
}

interface Client {
  id: string;
  name: string;
  hourlyRate: number;
  email?: string;
}

interface Project {
  id: string;
  name: string;
}

interface ReportMeta {
  title: string;
  client: Client;
  period: string;
  generatedAt: Date;
  hourlyRate?: number;
}

function fmtDate(dateStr: string) {
  try { return format(parseISO(dateStr + 'T00:00:00'), 'MMM d, yyyy'); } catch { return dateStr; }
}

function buildDuplicateSection(tasks: Task[], getProject: (id: string) => Project | undefined): string {
  // Group by normalized description
  const groups = new Map<string, Task[]>();
  tasks.forEach(t => {
    const key = t.description.trim().toLowerCase();
    const g = groups.get(key) || [];
    g.push(t);
    groups.set(key, g);
  });

  const dupes = [...groups.values()].filter(g => g.length >= 2).sort((a, b) => b.length - a.length);

  if (dupes.length === 0) {
    return `## Duplicate Analysis\n\n> No exact duplicate descriptions found across ${tasks.length} tasks.\n\n`;
  }

  let md = `## Duplicate Analysis\n\n`;
  md += `> **${dupes.length} duplicate group(s) found** across ${tasks.length} tasks. Review below.\n\n`;
  md += `> *Prompt for AI: "Review the duplicate groups below. For each group, determine if these are legitimately separate tasks or likely billing errors. Flag any that look suspicious and suggest which to keep or merge."*\n\n`;

  dupes.forEach((group, i) => {
    const desc = group[0].description;
    md += `### Duplicate Group ${i + 1} — ${group.length} entries\n\n`;
    md += `**Description:** "${desc}"\n\n`;
    md += `| # | Date | Project | Type | Status | Hours | Cost |\n`;
    md += `|---|------|---------|------|--------|-------|------|\n`;
    group.forEach((t, idx) => {
      const proj = getProject(t.projectId)?.name || t.projectId;
      const hours = t.hours != null ? `${t.hours}h` : '—';
      const cost = t.cost != null ? `$${t.cost.toFixed(2)}` : '—';
      md += `| ${idx + 1} | ${fmtDate(t.date)} | ${proj} | ${t.type} | ${t.status} | ${hours} | ${cost} |\n`;
    });
    md += `\n`;
  });

  return md;
}

function buildTaskTable(tasks: Task[], getProject: (id: string) => Project | undefined, hourlyRate?: number): string {
  if (tasks.length === 0) return '_No tasks in this period._\n\n';

  const serviceTasks = tasks.filter(t => t.type !== 'insumos');
  const supplyTasks = tasks.filter(t => t.type === 'insumos');

  let md = '';

  if (serviceTasks.length > 0) {
    md += `### Service Tasks (${serviceTasks.length})\n\n`;
    md += `| Date | Description | Project | Type | Priority | Status | Hours | Revenue |\n`;
    md += `|------|-------------|---------|------|----------|--------|-------|---------|\n`;
    serviceTasks
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach(t => {
        const proj = getProject(t.projectId)?.name || '—';
        const hrs = t.hours != null ? `${t.hours}h` : '—';
        const rev = (t.hours != null && hourlyRate) ? `$${(t.hours * hourlyRate).toFixed(2)}` : '—';
        const desc = t.description.replace(/\|/g, '\\|');
        md += `| ${fmtDate(t.date)} | ${desc} | ${proj} | ${t.type} | ${t.priority} | ${t.status} | ${hrs} | ${rev} |\n`;
      });
    md += `\n`;
  }

  if (supplyTasks.length > 0) {
    md += `### Supply Tasks (${supplyTasks.length})\n\n`;
    md += `| Date | Description | Project | Priority | Status | Cost |\n`;
    md += `|------|-------------|---------|----------|--------|------|\n`;
    supplyTasks
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach(t => {
        const proj = getProject(t.projectId)?.name || '—';
        const cost = t.cost != null ? `$${t.cost.toFixed(2)}` : '—';
        const desc = t.description.replace(/\|/g, '\\|');
        md += `| ${fmtDate(t.date)} | ${desc} | ${proj} | ${t.priority} | ${t.status} | ${cost} |\n`;
      });
    md += `\n`;
  }

  return md;
}

export function generateMarkdownReport(
  tasks: Task[],
  meta: ReportMeta,
  getProject: (id: string) => Project | undefined,
): string {
  const serviceTasks = tasks.filter(t => t.type !== 'insumos');
  const supplyTasks = tasks.filter(t => t.type === 'insumos');
  const totalHours = serviceTasks.reduce((s, t) => s + (t.hours || 0), 0);
  const totalRevenue = serviceTasks.reduce((s, t) => s + (t.hours || 0) * (meta.hourlyRate || 0), 0);
  const totalSupplies = supplyTasks.reduce((s, t) => s + (t.cost || 0), 0);
  const incidents = serviceTasks.filter(t => t.type === 'incident').length;
  const requests = serviceTasks.filter(t => t.type === 'request').length;

  let md = '';

  // Title
  md += `# ${meta.title}\n\n`;
  md += `> Generated: ${format(meta.generatedAt, 'MMMM d, yyyy · HH:mm')}\n\n`;

  // Report details
  md += `## Report Details\n\n`;
  md += `| Field | Value |\n`;
  md += `|-------|-------|\n`;
  md += `| Client | ${meta.client.name} |\n`;
  md += `| Period | ${meta.period} |\n`;
  if (meta.client.email) md += `| Email | ${meta.client.email} |\n`;
  if (meta.hourlyRate) md += `| Service Rate | $${meta.hourlyRate.toFixed(2)}/hour |\n`;
  md += `\n`;

  // Summary
  md += `## Summary\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Total Tasks | ${tasks.length} |\n`;
  md += `| Incidents | ${incidents} |\n`;
  md += `| Requests | ${requests} |\n`;
  if (supplyTasks.length > 0) md += `| Supplies | ${supplyTasks.length} |\n`;
  md += `| Total Hours | ${totalHours.toFixed(1)}h |\n`;
  if (meta.hourlyRate) md += `| Service Revenue | $${totalRevenue.toFixed(2)} |\n`;
  if (supplyTasks.length > 0) md += `| Supplies Cost | $${totalSupplies.toFixed(2)} |\n`;
  md += `\n`;

  // All tasks
  md += `## Tasks\n\n`;
  md += buildTaskTable(tasks, getProject, meta.hourlyRate);

  // Duplicate analysis — always included
  md += buildDuplicateSection(tasks, getProject);

  md += `---\n_Report generated by TaskTracker Pro_\n`;

  return md;
}

export function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
