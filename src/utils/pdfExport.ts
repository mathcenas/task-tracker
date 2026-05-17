import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';

interface CompanySettings {
  company_name: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  tax_id: string | null;
}

export interface ReportTask {
  id: string;
  clientId: string;
  projectId: string;
  description: string;
  hours?: number;
  cost?: number;
  date: string;
  type: string;
  status?: string;
  priority?: string;
  finished?: boolean;
  notes?: string;
  isRecurring?: boolean;
  approvalStatus?: string;
  vendor?: string;
  approvedBy?: string;
  receiptRef?: string;
}

export interface ReportClient {
  id: string;
  name: string;
  hourlyRate: number;
  contactPerson?: string;
  email?: string;
}

export interface ReportProject {
  id: string;
  name: string;
}

export class PDFExporter {
  private doc: jsPDF;
  private companySettings: CompanySettings;
  currentY: number = 20;

  constructor(companySettings: CompanySettings) {
    this.doc = new jsPDF();
    this.companySettings = companySettings;
  }

  private async loadLogo(): Promise<{ data: string; format: string } | null> {
    if (!this.companySettings.logo_url) return null;
    try {
      // If already a data URL, use it directly
      if (this.companySettings.logo_url.startsWith('data:')) {
        const match = this.companySettings.logo_url.match(/^data:image\/(\w+);base64,/);
        const format = match ? match[1].toUpperCase() : 'PNG';
        return { data: this.companySettings.logo_url, format: format === 'JPEG' ? 'JPEG' : format === 'JPG' ? 'JPEG' : 'PNG' };
      }
      // Make relative URLs absolute
      const url = this.companySettings.logo_url.startsWith('http')
        ? this.companySettings.logo_url
        : `${window.location.origin}${this.companySettings.logo_url.startsWith('/') ? '' : '/'}${this.companySettings.logo_url}`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const blob = await response.blob();
      const format = blob.type.includes('jpeg') || blob.type.includes('jpg') ? 'JPEG' : 'PNG';
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve({ data: reader.result as string, format });
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  async addHeader(title: string) {
    this.currentY = 15;

    if (this.companySettings.logo_url) {
      const logo = await this.loadLogo();
      if (logo) {
        try {
          // Logo: up to 50mm wide, 20mm tall, preserving space
          this.doc.addImage(logo.data, logo.format, 15, this.currentY, 50, 20);
        } catch { /* ignore logo if it still fails */ }
      }
    }

    let companyY = this.currentY;
    const rightMargin = 195;

    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(30, 30, 30);
    this.doc.text(this.companySettings.company_name, rightMargin, companyY, { align: 'right' });
    companyY += 5;

    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(100, 100, 100);

    if (this.companySettings.address) {
      const addressLines = this.doc.splitTextToSize(this.companySettings.address, 75);
      addressLines.forEach((line: string) => {
        this.doc.text(line, rightMargin, companyY, { align: 'right' });
        companyY += 3.5;
      });
    }
    if (this.companySettings.phone) { this.doc.text(this.companySettings.phone, rightMargin, companyY, { align: 'right' }); companyY += 3.5; }
    if (this.companySettings.email) { this.doc.text(this.companySettings.email, rightMargin, companyY, { align: 'right' }); companyY += 3.5; }
    if (this.companySettings.website) { this.doc.text(this.companySettings.website, rightMargin, companyY, { align: 'right' }); companyY += 3.5; }

    this.currentY = Math.max(this.currentY + 28, companyY + 3);

    this.doc.setDrawColor(37, 99, 235);
    this.doc.setLineWidth(0.5);
    this.doc.line(15, this.currentY, 195, this.currentY);
    this.currentY += 8;

    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(37, 99, 235);
    this.doc.text(title, 15, this.currentY);
    this.currentY += 10;

    return this.currentY;
  }

  addSection(title: string, content: Record<string, string>) {
    const rows = Object.keys(content).length;
    const blockHeight = rows * 5.5 + 10;

    // Page break if section won't fit
    if (this.currentY + blockHeight > 270) {
      this.doc.addPage();
      this.currentY = 20;
    }

    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(50, 50, 50);
    this.doc.text(title, 15, this.currentY);
    this.currentY += 6;

    this.doc.setFillColor(248, 250, 252);
    this.doc.roundedRect(15, this.currentY - 3, 180, rows * 5.5 + 4, 2, 2, 'F');
    this.currentY += 2;

    this.doc.setFontSize(9);
    this.doc.setTextColor(70, 70, 70);

    Object.entries(content).forEach(([key, value]) => {
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`${key}:`, 20, this.currentY);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(30, 30, 30);
      // Truncate long values so they don't overflow the box
      const safeValue = this.doc.splitTextToSize(value, 120)[0];
      this.doc.text(safeValue, 65, this.currentY);
      this.doc.setTextColor(70, 70, 70);
      this.currentY += 5.5;
    });

    this.currentY += 6;
  }

  addSectionTitle(title: string) {
    if (this.currentY > 270) { this.doc.addPage(); this.currentY = 20; }
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(50, 50, 50);
    this.doc.text(title, 15, this.currentY);
    this.currentY += 8;
  }

  addTable(headers: string[], rows: any[][], options?: any) {
    const pageWidth = this.doc.internal.pageSize.getWidth();
    const availableWidth = pageWidth - 28;

    (this.doc as any).autoTable({
      startY: this.currentY,
      head: [headers],
      body: rows,
      theme: 'striped',
      margin: { left: 14, right: 14 },
      tableWidth: availableWidth,
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: { fontSize: 9, textColor: 50 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      styles: { overflow: 'linebreak', cellPadding: { top: 3, bottom: 3, left: 3, right: 3 }, minCellWidth: 8 },
      ...options
    });

    this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
  }

  addTotals(items: { label: string; value: string; bold?: boolean }[]) {
    const startX = 125;
    // Estimate total height needed: ~6px per regular item, ~13px per bold item
    const estimatedHeight = items.reduce((h, i) => h + (i.bold ? 13 : 6), 10);
    if (this.currentY + estimatedHeight > 278) { this.doc.addPage(); this.currentY = 20; }
    this.currentY += 5;

    items.forEach((item) => {
      if (this.currentY > 275) { this.doc.addPage(); this.currentY = 20; }

      if (item.bold) {
        this.doc.setDrawColor(37, 99, 235);
        this.doc.setLineWidth(0.3);
        this.doc.line(startX, this.currentY - 2, 195, this.currentY - 2);
        this.currentY += 3;

        this.doc.setFillColor(37, 99, 235);
        this.doc.roundedRect(startX, this.currentY - 6, 70, 10, 1, 1, 'F');

        this.doc.setFontSize(11);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(255, 255, 255);
        this.doc.text(item.label, startX + 3, this.currentY);
        this.doc.text(item.value, 192, this.currentY, { align: 'right' });
        this.currentY += 8;
      } else {
        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(70, 70, 70);
        this.doc.text(item.label, startX, this.currentY);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(30, 30, 30);
        this.doc.text(item.value, 195, this.currentY, { align: 'right' });
        this.currentY += 5.5;
      }
    });
  }

  addNotes(title: string, content: string) {
    if (!content) return;

    this.currentY += 8;
    if (this.currentY > 265) { this.doc.addPage(); this.currentY = 20; }

    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(50, 50, 50);
    this.doc.text(title, 15, this.currentY);
    this.currentY += 5;

    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(70, 70, 70);
    const lines = this.doc.splitTextToSize(content, 175);

    this.doc.setFillColor(252, 252, 253);
    this.doc.setDrawColor(230, 230, 230);
    this.doc.setLineWidth(0.1);
    this.doc.roundedRect(15, this.currentY - 3, 180, lines.length * 4 + 4, 1, 1, 'FD');
    this.currentY += 1;

    lines.forEach((line: string) => {
      if (this.currentY > 270) { this.doc.addPage(); this.currentY = 20; }
      this.doc.text(line, 20, this.currentY);
      this.currentY += 4;
    });

    this.currentY += 3;
  }

  /**
   * Renders the standard service + supplies tables, breakdown, and totals block.
   * Used by monthly, project, and public reports so all PDFs are consistent.
   */
  addClientReportSections(
    tasks: ReportTask[],
    getProject: (id: string) => ReportProject | undefined,
    hourlyRate: number
  ) {
    const servicesTasks = tasks.filter(t => t.type !== 'insumos');
    const suppliesTasks = tasks.filter(t => t.type === 'insumos');

    // ── Services table ────────────────────────────────────────────────
    if (servicesTasks.length > 0) {
      this.addSectionTitle('Services');

      const servicesRows = servicesTasks.map(task => [
        format(new Date(task.date), 'MMM d, yyyy'),
        getProject(task.projectId)?.name || '—',
        task.type === 'incident' ? 'Incident' : 'Request',
        task.description,
        `${(task.hours || 0).toFixed(1)}h`,
        `$${((task.hours || 0) * hourlyRate).toFixed(2)}`
      ]);

      const servicesTotal = servicesTasks.reduce((s, t) => s + (t.hours || 0) * hourlyRate, 0);
      const totalHoursStr = `${servicesTasks.reduce((s, t) => s + (t.hours || 0), 0).toFixed(1)}h`;

      // Total row appended as a styled body row (more reliable than foot across jspdf-autotable versions)
      const servicesTotalRow = [
        { content: 'Total', colSpan: 4, styles: { fontStyle: 'bold', halign: 'right' as const, fillColor: [235, 240, 255] as [number,number,number], textColor: [30, 30, 30] as [number,number,number] } },
        { content: totalHoursStr, styles: { fontStyle: 'bold', halign: 'center' as const, fillColor: [235, 240, 255] as [number,number,number], textColor: [30, 30, 30] as [number,number,number] } },
        { content: `$${servicesTotal.toFixed(2)}`, styles: { fontStyle: 'bold', halign: 'right' as const, fillColor: [235, 240, 255] as [number,number,number], textColor: [30, 30, 30] as [number,number,number] } }
      ];

      this.addTable(
        ['Date', 'Project', 'Type', 'Description', 'Hours', 'Amount'],
        [...servicesRows, servicesTotalRow],
        {
          columnStyles: {
            0: { cellWidth: 24 },
            1: { cellWidth: 28 },
            2: { cellWidth: 20 },
            3: { cellWidth: 'auto' },
            4: { cellWidth: 18, halign: 'center' },
            5: { cellWidth: 26, halign: 'right' }
          }
        }
      );
    }

    // ── Supplies table ────────────────────────────────────────────────
    if (suppliesTasks.length > 0) {
      this.addSectionTitle('Supplies');

      const suppliesRows = suppliesTasks.map(task => [
        format(new Date(task.date), 'MMM d, yyyy'),
        getProject(task.projectId)?.name || '—',
        task.description,
        `$${(task.cost || 0).toFixed(2)}`
      ]);

      const suppliesTotal = suppliesTasks.reduce((s, t) => s + (t.cost || 0), 0);

      const suppliesTotalRow = [
        { content: 'Supplies Total', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right' as const, fillColor: [209, 250, 229] as [number,number,number], textColor: [6, 78, 59] as [number,number,number] } },
        { content: `$${suppliesTotal.toFixed(2)}`, styles: { fontStyle: 'bold', halign: 'right' as const, fillColor: [209, 250, 229] as [number,number,number], textColor: [6, 78, 59] as [number,number,number] } }
      ];

      this.addTable(
        ['Date', 'Project', 'Description', 'Cost'],
        [...suppliesRows, suppliesTotalRow],
        {
          headStyles: { fillColor: [15, 118, 110] },
          columnStyles: {
            0: { cellWidth: 24 },
            1: { cellWidth: 32 },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 26, halign: 'right' }
          }
        }
      );
    }

    // ── Service type breakdown ────────────────────────────────────────
    const incidentTasks = servicesTasks.filter(t => t.type === 'incident');
    const requestTasks  = servicesTasks.filter(t => t.type === 'request');

    if (incidentTasks.length > 0 || requestTasks.length > 0) {
      this.addSectionTitle('Service Breakdown');

      const servicesTotal = servicesTasks.reduce((s, t) => s + (t.hours || 0) * hourlyRate, 0);
      const breakdownRows: any[][] = [];

      if (incidentTasks.length > 0) {
        const h = incidentTasks.reduce((s, t) => s + (t.hours || 0), 0);
        const amt = h * hourlyRate;
        breakdownRows.push([
          'Incidents',
          incidentTasks.length.toString(),
          `${h.toFixed(1)}h`,
          `$${amt.toFixed(2)}`,
          servicesTotal > 0 ? `${((amt / servicesTotal) * 100).toFixed(0)}%` : '0%'
        ]);
      }
      if (requestTasks.length > 0) {
        const h = requestTasks.reduce((s, t) => s + (t.hours || 0), 0);
        const amt = h * hourlyRate;
        breakdownRows.push([
          'Requests',
          requestTasks.length.toString(),
          `${h.toFixed(1)}h`,
          `$${amt.toFixed(2)}`,
          servicesTotal > 0 ? `${((amt / servicesTotal) * 100).toFixed(0)}%` : '0%'
        ]);
      }

      this.addTable(
        ['Type', 'Tasks', 'Hours', 'Amount', '% of Services'],
        breakdownRows,
        {
          theme: 'grid',
          headStyles: { fillColor: [75, 85, 99] },
          columnStyles: {
            0: { cellWidth: 'auto', fontStyle: 'bold' },
            1: { cellWidth: 22, halign: 'center' },
            2: { cellWidth: 25, halign: 'center' },
            3: { cellWidth: 30, halign: 'right' },
            4: { cellWidth: 30, halign: 'center' }
          }
        }
      );
    }

    // ── Grand totals block ────────────────────────────────────────────
    const totalHours    = servicesTasks.reduce((s, t) => s + (t.hours || 0), 0);
    const servicesTotal = servicesTasks.reduce((s, t) => s + (t.hours || 0) * hourlyRate, 0);
    const suppliesTotal = suppliesTasks.reduce((s, t) => s + (t.cost || 0), 0);
    const grandTotal    = servicesTotal + suppliesTotal;

    const totalsItems: { label: string; value: string; bold?: boolean }[] = [
      { label: 'Total Service Hours:', value: `${totalHours.toFixed(2)}h` },
      { label: 'Services Total:', value: `$${servicesTotal.toFixed(2)}` }
    ];
    if (suppliesTotal > 0) {
      totalsItems.push({ label: 'Supplies Total:', value: `$${suppliesTotal.toFixed(2)}` });
    }
    totalsItems.push({ label: 'Total Amount:', value: `$${grandTotal.toFixed(2)}`, bold: true });

    this.addTotals(totalsItems);
  }

  addFooter() {
    const pageCount = this.doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(8);
      this.doc.setTextColor(150, 150, 150);
      this.doc.text(
        `Generated by ${this.companySettings.company_name} — Page ${i} of ${pageCount}`,
        105, 290, { align: 'center' }
      );
    }
  }

  save(filename: string) {
    this.addFooter();
    this.doc.save(filename);
  }

  getDoc(): jsPDF {
    return this.doc;
  }
}
