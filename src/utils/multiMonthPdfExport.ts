import { PDFExporter } from './pdfExport';
import { format } from 'date-fns';
import type { Task, Client, Project } from '../types';

interface MonthData {
  month: string;
  tasks: Task[];
  totalHours: number;
  serviceRevenue: number;
  suppliesCost: number;
  netRevenue: number;
  incidentCount: number;
  requestCount: number;
  suppliesCount: number;
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

export async function exportMultiMonthPDF(
  monthsData: MonthData[],
  getClient: (id: string) => Client | undefined,
  getProject: (id: string) => Project | undefined,
  companySettings: CompanySettings,
  filename: string
) {
  const pdf = new PDFExporter(companySettings);

  const dateRange = monthsData.length > 0
    ? `${monthsData[0].month} - ${monthsData[monthsData.length - 1].month}`
    : 'Multi-Month Report';

  await pdf.addHeader(`Multi-Month Report: ${dateRange}`);

  // Executive Summary
  const totalHours = monthsData.reduce((sum, m) => sum + m.totalHours, 0);
  const totalServiceRevenue = monthsData.reduce((sum, m) => sum + m.serviceRevenue, 0);
  const totalSuppliesCost = monthsData.reduce((sum, m) => sum + m.suppliesCost, 0);
  const totalNetRevenue = monthsData.reduce((sum, m) => sum + m.netRevenue, 0);
  const totalTasks = monthsData.reduce((sum, m) => sum + m.tasks.length, 0);
  const totalIncidents = monthsData.reduce((sum, m) => sum + m.incidentCount, 0);
  const totalRequests = monthsData.reduce((sum, m) => sum + m.requestCount, 0);
  const totalSupplies = monthsData.reduce((sum, m) => sum + m.suppliesCount, 0);

  pdf.addSection('Executive Summary', {
    'Reporting Period': dateRange,
    'Total Months': monthsData.length.toString(),
    'Total Tasks Completed': totalTasks.toString(),
    'Total Service Hours': `${totalHours.toFixed(1)} hours`,
    'Average Monthly Hours': `${(totalHours / monthsData.length).toFixed(1)} hours`,
    'Total Net Revenue': `$${totalNetRevenue.toFixed(2)}`
  });

  // Monthly Breakdown Table
  pdf.addSectionTitle('Monthly Performance Overview');

  const monthlyBreakdown = monthsData.map(month => [
    month.month,
    month.tasks.length.toString(),
    `${month.totalHours.toFixed(1)}h`,
    `$${month.serviceRevenue.toFixed(2)}`,
    `$${month.suppliesCost.toFixed(2)}`,
    `$${month.netRevenue.toFixed(2)}`
  ]);

  pdf.addTable(
    ['Month', 'Tasks', 'Hours', 'Services', 'Supplies', 'Net Revenue'],
    monthlyBreakdown,
    {
      theme: 'grid',
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: 255,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 30, fontStyle: 'bold' },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 28, halign: 'right' },
        4: { cellWidth: 28, halign: 'right' },
        5: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }
      }
    }
  );

  // Task Type Distribution
  pdf.addSectionTitle('Task Type Distribution');

  const taskTypeData = [
    ['Incidents', totalIncidents.toString(), `${((totalIncidents / totalTasks) * 100).toFixed(1)}%`],
    ['Requests', totalRequests.toString(), `${((totalRequests / totalTasks) * 100).toFixed(1)}%`],
    ['Supplies', totalSupplies.toString(), `${((totalSupplies / totalTasks) * 100).toFixed(1)}%`]
  ];

  pdf.addTable(
    ['Type', 'Count', 'Percentage'],
    taskTypeData,
    {
      theme: 'striped',
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 35, halign: 'center' },
        2: { cellWidth: 35, halign: 'center' }
      }
    }
  );

  // Client Analysis
  const allTasks = monthsData.flatMap(m => m.tasks);
  const clientStats: Record<string, {
    name: string;
    hours: number;
    revenue: number;
    taskCount: number;
    suppliesCost: number;
  }> = {};

  allTasks.forEach(task => {
    const client = getClient(task.clientId);
    if (!client) return;

    if (!clientStats[task.clientId]) {
      clientStats[task.clientId] = {
        name: client.name,
        hours: 0,
        revenue: 0,
        taskCount: 0,
        suppliesCost: 0
      };
    }

    clientStats[task.clientId].taskCount += 1;

    if (task.type === 'insumos') {
      clientStats[task.clientId].suppliesCost += task.cost || 0;
    } else {
      const hours = task.hours || 0;
      clientStats[task.clientId].hours += hours;
      clientStats[task.clientId].revenue += hours * client.hourlyRate;
    }
  });

  pdf.addSectionTitle('Client Performance Analysis');

  const clientData = Object.entries(clientStats)
    .sort((a, b) => (b[1].revenue - b[1].suppliesCost) - (a[1].revenue - a[1].suppliesCost))
    .map(([_, stats]) => [
      stats.name,
      stats.taskCount.toString(),
      `${stats.hours.toFixed(1)}h`,
      `$${stats.revenue.toFixed(2)}`,
      `$${stats.suppliesCost.toFixed(2)}`,
      `$${(stats.revenue - stats.suppliesCost).toFixed(2)}`
    ]);

  pdf.addTable(
    ['Client', 'Tasks', 'Hours', 'Services', 'Supplies', 'Net'],
    clientData,
    {
      theme: 'grid',
      headStyles: {
        fillColor: [37, 99, 235]
      },
      columnStyles: {
        0: { cellWidth: 42, fontStyle: 'bold' },
        1: { cellWidth: 16, halign: 'center' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 26, halign: 'right' },
        4: { cellWidth: 26, halign: 'right' },
        5: { cellWidth: 26, halign: 'right', fontStyle: 'bold' }
      }
    }
  );

  // Detailed Month-by-Month Breakdown
  monthsData.forEach((monthData, index) => {
    // Add page break for each new month (except the first)
    if (index > 0) {
      const doc = pdf.getDoc();
      doc.addPage();
      pdf.currentY = 20;
    }

    pdf.addSectionTitle(`Detailed Breakdown: ${monthData.month}`);

    // Month summary
    pdf.addSection('Month Summary', {
      'Total Tasks': monthData.tasks.length.toString(),
      'Service Hours': `${monthData.totalHours.toFixed(1)} hours`,
      'Service Revenue': `$${monthData.serviceRevenue.toFixed(2)}`,
      'Supplies Cost': `$${monthData.suppliesCost.toFixed(2)}`,
      'Net Revenue': `$${monthData.netRevenue.toFixed(2)}`,
      'Incidents': monthData.incidentCount.toString(),
      'Requests': monthData.requestCount.toString(),
      'Supplies': monthData.suppliesCount.toString()
    });

    // Group tasks by client for this month
    const monthClientGroups: Record<string, Task[]> = {};

    monthData.tasks.forEach(task => {
      if (!monthClientGroups[task.clientId]) {
        monthClientGroups[task.clientId] = [];
      }
      monthClientGroups[task.clientId].push(task);
    });

    // Tasks by client
    Object.entries(monthClientGroups).forEach(([clientId, clientTasks]) => {
      const client = getClient(clientId);
      if (!client) return;

      pdf.addSectionTitle(`${client.name} - ${clientTasks.length} task(s)`);

      const taskRows = clientTasks.map(task => {
        const project = getProject(task.projectId);
        const taskType = task.type === 'incident' ? 'Incident' :
                        task.type === 'insumos' ? 'Supply' : 'Request';

        let amount = '';
        if (task.type === 'insumos') {
          amount = `$${(task.cost || 0).toFixed(2)}`;
        } else {
          const hours = task.hours || 0;
          amount = `$${(hours * client.hourlyRate).toFixed(2)}`;
        }

        return [
          format(new Date(task.date), 'MMM dd'),
          taskType,
          project?.name || 'General',
          task.description,
          task.type === 'insumos' ? '-' : `${(task.hours || 0).toFixed(1)}h`,
          amount
        ];
      });

      pdf.addTable(
        ['Date', 'Type', 'Project', 'Description', 'Hours', 'Amount'],
        taskRows,
        {
          theme: 'striped',
          headStyles: {
            fillColor: [100, 100, 100],
            fontSize: 9
          },
          bodyStyles: {
            fontSize: 8
          },
          columnStyles: {
            0: { cellWidth: 18 },
            1: { cellWidth: 16 },
            2: { cellWidth: 26 },
            3: { cellWidth: 58, cellPadding: 2 },
            4: { cellWidth: 16, halign: 'center' },
            5: { cellWidth: 24, halign: 'right', fontStyle: 'bold' }
          },
          styles: {
            overflow: 'linebreak',
            cellWidth: 'wrap'
          }
        }
      );

      // Client month totals
      const clientHours = clientTasks
        .filter(t => t.type !== 'insumos')
        .reduce((sum, t) => sum + (t.hours || 0), 0);

      const clientServiceRevenue = clientHours * client.hourlyRate;

      const clientSupplies = clientTasks
        .filter(t => t.type === 'insumos')
        .reduce((sum, t) => sum + (t.cost || 0), 0);

      // Supplies detail sub-table if client has any supply tasks
      const clientSupplyTasks = clientTasks.filter(t => t.type === 'insumos');
      if (clientSupplyTasks.length > 0) {
        pdf.addSectionTitle(`${client.name} — Supplies Detail`);

        const supplyRows = clientSupplyTasks.map(task => {
          const approvalLabel = task.approvalStatus === 'approved' ? 'Approved' :
                                task.approvalStatus === 'rejected' ? 'Rejected' : 'Pending';
          return [
            format(new Date(task.date), 'MMM dd'),
            task.description,
            (task as any).vendor || '-',
            (task as any).approvedBy || '-',
            (task as any).receiptRef || '-',
            task.isRecurring ? 'Fixed' : 'One-time',
            approvalLabel,
            `$${(task.cost || 0).toFixed(2)}`
          ];
        });

        const suppliesSubTotal = clientSupplyTasks.reduce((s, t) => s + (t.cost || 0), 0);
        const suppliesTotalRow = [
          { content: 'Supplies Total', colSpan: 7, styles: { fontStyle: 'bold', halign: 'right', fillColor: [209, 250, 229], textColor: [6, 78, 59] } },
          { content: `$${suppliesSubTotal.toFixed(2)}`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [209, 250, 229], textColor: [6, 78, 59] } }
        ];
        pdf.addTable(
          ['Date', 'Description', 'Vendor', 'Approved By', 'Ref', 'Type', 'Status', 'Cost'],
          [...supplyRows, suppliesTotalRow],
          {
            theme: 'striped',
            headStyles: { fillColor: [20, 120, 100], fontSize: 8 },
            bodyStyles: { fontSize: 7.5 },
            columnStyles: {
              0: { cellWidth: 14 },
              1: { cellWidth: 38, cellPadding: 2 },
              2: { cellWidth: 24 },
              3: { cellWidth: 24 },
              4: { cellWidth: 20 },
              5: { cellWidth: 14, halign: 'center' },
              6: { cellWidth: 16, halign: 'center' },
              7: { cellWidth: 18, halign: 'right', fontStyle: 'bold' }
            },
            styles: { overflow: 'linebreak' }
          }
        );
      }

      pdf.addTotals([
        { label: 'Service Hours:', value: `${clientHours.toFixed(1)}h` },
        { label: 'Service Revenue:', value: `$${clientServiceRevenue.toFixed(2)}` },
        { label: 'Supplies:', value: `$${clientSupplies.toFixed(2)}` },
        { label: 'Client Total:', value: `$${(clientServiceRevenue + clientSupplies).toFixed(2)}`, bold: true }
      ]);
    });
  });

  // Overall Totals
  const doc = pdf.getDoc();
  doc.addPage();
  pdf.currentY = 20;

  pdf.addSectionTitle('Overall Period Totals');

  pdf.addTotals([
    { label: 'Total Service Hours:', value: `${totalHours.toFixed(1)}h` },
    { label: 'Average Hours/Month:', value: `${(totalHours / monthsData.length).toFixed(1)}h` },
    { label: 'Service Revenue:', value: `$${totalServiceRevenue.toFixed(2)}` },
    { label: 'Supplies Cost:', value: `-$${totalSuppliesCost.toFixed(2)}` },
    { label: 'NET REVENUE:', value: `$${totalNetRevenue.toFixed(2)}`, bold: true }
  ]);

  pdf.addNotes(
    'Report Notes',
    `This report covers ${monthsData.length} month(s) from ${dateRange}. ` +
    `Total of ${totalTasks} tasks completed across all clients. ` +
    `Breakdown: ${totalIncidents} incidents, ${totalRequests} requests, ${totalSupplies} supplies.`
  );

  pdf.save(filename);
}
