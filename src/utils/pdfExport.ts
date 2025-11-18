import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface CompanySettings {
  company_name: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  tax_id: string | null;
}

export class PDFExporter {
  private doc: jsPDF;
  private companySettings: CompanySettings;
  private currentY: number = 20;

  constructor(companySettings: CompanySettings) {
    this.doc = new jsPDF();
    this.companySettings = companySettings;
  }

  private async loadLogo(): Promise<string | null> {
    if (!this.companySettings.logo_url) return null;

    try {
      const response = await fetch(this.companySettings.logo_url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Failed to load logo:', error);
      return null;
    }
  }

  async addHeader(title: string) {
    this.currentY = 20;

    if (this.companySettings.logo_url) {
      try {
        this.doc.addImage(this.companySettings.logo_url, 'PNG', 15, this.currentY, 40, 15);
      } catch (error) {
        console.error('Failed to add logo to PDF:', error);
        const logoData = await this.loadLogo();
        if (logoData) {
          try {
            this.doc.addImage(logoData, 'PNG', 15, this.currentY, 40, 15);
          } catch (e) {
            console.error('Failed to add logo as base64:', e);
          }
        }
      }
    }

    this.doc.setFontSize(10);
    this.doc.setTextColor(60, 60, 60);
    let companyY = this.currentY;

    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(this.companySettings.company_name, 200, companyY, { align: 'right' });
    companyY += 6;

    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');

    if (this.companySettings.address) {
      const addressLines = this.doc.splitTextToSize(this.companySettings.address, 80);
      addressLines.forEach((line: string) => {
        this.doc.text(line, 200, companyY, { align: 'right' });
        companyY += 4;
      });
    }

    if (this.companySettings.phone) {
      this.doc.text(`Phone: ${this.companySettings.phone}`, 200, companyY, { align: 'right' });
      companyY += 4;
    }

    if (this.companySettings.email) {
      this.doc.text(`Email: ${this.companySettings.email}`, 200, companyY, { align: 'right' });
      companyY += 4;
    }

    if (this.companySettings.website) {
      this.doc.text(`Web: ${this.companySettings.website}`, 200, companyY, { align: 'right' });
      companyY += 4;
    }

    if (this.companySettings.tax_id) {
      this.doc.text(`Tax ID: ${this.companySettings.tax_id}`, 200, companyY, { align: 'right' });
      companyY += 4;
    }

    this.currentY = Math.max(this.currentY + 30, companyY + 5);

    this.doc.setFontSize(24);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 0, 0);
    this.doc.text(title, 105, this.currentY, { align: 'center' });

    this.currentY += 15;

    return this.currentY;
  }

  addSection(title: string, content: Record<string, string>) {
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(60, 60, 60);
    this.doc.text(title, 15, this.currentY);
    this.currentY += 7;

    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(80, 80, 80);

    Object.entries(content).forEach(([key, value]) => {
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`${key}:`, 15, this.currentY);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(value, 60, this.currentY);
      this.currentY += 5;
    });

    this.currentY += 3;
  }

  addTable(headers: string[], rows: any[][], options?: any) {
    (this.doc as any).autoTable({
      startY: this.currentY,
      head: [headers],
      body: rows,
      theme: 'striped',
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: {
        fontSize: 9,
        textColor: 50
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250]
      },
      ...options
    });

    this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
  }

  addTotals(items: { label: string; value: string; bold?: boolean }[]) {
    const startX = 140;

    items.forEach(item => {
      if (item.bold) {
        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setDrawColor(100, 100, 100);
        this.doc.line(startX, this.currentY - 3, 200, this.currentY - 3);
      } else {
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'normal');
      }

      this.doc.text(item.label, startX, this.currentY);
      this.doc.text(item.value, 200, this.currentY, { align: 'right' });
      this.currentY += item.bold ? 8 : 6;
    });
  }

  addNotes(title: string, content: string) {
    if (!content) return;

    this.currentY += 5;
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(60, 60, 60);
    this.doc.text(title, 15, this.currentY);
    this.currentY += 7;

    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(80, 80, 80);
    const lines = this.doc.splitTextToSize(content, 180);
    lines.forEach((line: string) => {
      if (this.currentY > 270) {
        this.doc.addPage();
        this.currentY = 20;
      }
      this.doc.text(line, 15, this.currentY);
      this.currentY += 4;
    });
  }

  addFooter() {
    const pageCount = this.doc.getNumberOfPages();

    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(8);
      this.doc.setTextColor(150, 150, 150);
      this.doc.text(
        `Generated by ${this.companySettings.company_name} - Page ${i} of ${pageCount}`,
        105,
        290,
        { align: 'center' }
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
