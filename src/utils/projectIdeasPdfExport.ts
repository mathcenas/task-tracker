import { PDFExporter } from './pdfExport';
import { format, parseISO } from 'date-fns';

interface Task {
  id: string;
  clientId: string;
  projectId: string;
  description: string;
  hours?: number;
  cost?: number;
  date: string;
  type: string;
  status: string;
  priority: string;
  finished: boolean;
  notes?: string;
}

interface Project {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  startDate?: string;
  status: string;
}

interface Client {
  id: string;
  name: string;
  hourlyRate: number;
  contactPerson?: string;
  email?: string;
}

interface CompanySettings {
  company_name: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  tax_id: string | null;
}

export async function exportProjectIdeasPDF(
  project: Project,
  client: Client,
  tasks: Task[],
  companySettings: CompanySettings
) {
  const pdf = new PDFExporter(companySettings);

  await pdf.addHeader('Project Summary & Future Tasks');

  const projectInfo: Record<string, string> = {
    'Project': project.name,
    'Client': client.name,
    'Status': project.status.charAt(0).toUpperCase() + project.status.slice(1).replace('-', ' '),
    'Hourly Rate': `€${client.hourlyRate.toFixed(2)} / hr`,
    'Generated': format(new Date(), 'MMMM d, yyyy'),
  };

  if (project.startDate) {
    projectInfo['Start Date'] = format(parseISO(project.startDate), 'MMMM d, yyyy');
  }

  if (client.contactPerson) {
    projectInfo['Contact'] = client.contactPerson;
  }

  pdf.addSection('Project Details', projectInfo);

  if (project.description) {
    pdf.addNotes('Project Description', project.description);
  }

  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sortedTasks = [...tasks].sort((a, b) => {
    const pa = priorityOrder[a.priority] ?? 2;
    const pb = priorityOrder[b.priority] ?? 2;
    if (pa !== pb) return pa - pb;
    return a.date.localeCompare(b.date);
  });

  const overdueOrActive = sortedTasks.filter(t => !t.finished);
  const withNotes = overdueOrActive.filter(t => t.notes);
  const withoutNotes = overdueOrActive.filter(t => !t.notes);

  if (overdueOrActive.length > 0) {
    pdf.addSectionTitle(`Planned Tasks (${overdueOrActive.length})`);

    const headers = ['Priority', 'Type', 'Task Description', 'Status', 'Target Date', 'Est. Hours', 'Est. Cost'];
    const rows = overdueOrActive.map(task => {
      const estHours = task.hours ?? 0;
      const estCost = task.type === 'insumos'
        ? (task.cost ?? 0)
        : estHours * client.hourlyRate;

      return [
        task.priority.charAt(0).toUpperCase() + task.priority.slice(1),
        task.type === 'insumos' ? 'Supplies' : task.type.charAt(0).toUpperCase() + task.type.slice(1),
        task.description,
        task.status.replace('_', ' ').charAt(0).toUpperCase() + task.status.replace('_', ' ').slice(1),
        format(parseISO(task.date), 'MMM d, yyyy'),
        estHours > 0 ? `${estHours}h` : '-',
        estCost > 0 ? `€${estCost.toFixed(2)}` : '-',
      ];
    });

    pdf.addTable(headers, rows, {
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 20 },
        2: { cellWidth: 62 },
        3: { cellWidth: 22 },
        4: { cellWidth: 25 },
        5: { cellWidth: 15 },
        6: { cellWidth: 20 },
      },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 0) {
          const priority = data.cell.raw as string;
          if (priority === 'High') {
            data.cell.styles.textColor = [185, 28, 28];
            data.cell.styles.fontStyle = 'bold';
          } else if (priority === 'Medium') {
            data.cell.styles.textColor = [161, 98, 7];
          }
        }
      }
    });
  }

  if (withNotes.length > 0) {
    pdf.addSectionTitle('Ideas & Notes');

    withNotes.forEach(task => {
      if (task.notes) {
        const taskTitle = `[${task.priority.toUpperCase()}] ${task.description}`;
        pdf.addNotes(taskTitle, task.notes);
      }
    });
  }

  const totalEstHours = overdueOrActive.reduce((sum, t) => sum + (t.type !== 'insumos' ? (t.hours ?? 0) : 0), 0);
  const totalEstSupplies = overdueOrActive.reduce((sum, t) => sum + (t.type === 'insumos' ? (t.cost ?? 0) : 0), 0);
  const totalEstLabour = totalEstHours * client.hourlyRate;
  const totalEstCost = totalEstLabour + totalEstSupplies;

  if (totalEstHours > 0 || totalEstSupplies > 0) {
    const totals: { label: string; value: string; bold?: boolean }[] = [];

    if (totalEstHours > 0) {
      totals.push({ label: 'Estimated Hours', value: `${totalEstHours}h` });
      totals.push({ label: `Labour (${totalEstHours}h x €${client.hourlyRate}/hr)`, value: `€${totalEstLabour.toFixed(2)}` });
    }

    if (totalEstSupplies > 0) {
      totals.push({ label: 'Estimated Supplies', value: `€${totalEstSupplies.toFixed(2)}` });
    }

    if (totals.length > 0) {
      totals.push({ label: 'Total Estimated Cost', value: `€${totalEstCost.toFixed(2)}`, bold: true });
      pdf.addTotals(totals);
    }
  }

  const disclaimer =
    'This document is a preliminary summary of planned work and is not a formal quote or invoice. ' +
    'Actual hours, costs, and scope may vary. Final pricing will be confirmed before work begins.';
  pdf.addNotes('Note', disclaimer);

  const slug = project.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  pdf.save(`${slug}-project-summary-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
