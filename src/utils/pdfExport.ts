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
    this.currentY = 15;

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

    if (this.companySettings.phone) {
      this.doc.text(this.companySettings.phone, rightMargin, companyY, { align: 'right' });
      companyY += 3.5;
    }

    if (this.companySettings.email) {
      this.doc.text(this.companySettings.email, rightMargin, companyY, { align: 'right' });
      companyY += 3.5;
    }

    if (this.companySettings.website) {
      this.doc.text(this.companySettings.website, rightMargin, companyY, { align: 'right' });
      companyY += 3.5;
    }

    this.currentY = Math.max(this.currentY + 25, companyY + 3);

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
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(50, 50, 50);
    this.doc.text(title, 15, this.currentY);
    this.currentY += 6;

    this.doc.setFillColor(248, 250, 252);
    const sectionHeight = Object.keys(content).length * 5.5 + 4;
    this.doc.roundedRect(15, this.currentY - 3, 180, sectionHeight, 2, 2, 'F');
    this.currentY += 2;

    this.doc.setFontSize(9);
    this.doc.setTextColor(70, 70, 70);

    Object.entries(content).forEach(([key, value]) => {
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`${key}:`, 20, this.currentY);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(30, 30, 30);
      this.doc.text(value, 65, this.currentY);
      this.doc.setTextColor(70, 70, 70);
      this.currentY += 5.5;
    });

    this.currentY += 6;
  }

  addSectionTitle(title: string) {
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(50, 50, 50);
    this.doc.text(title, 15, this.currentY);
    this.currentY += 8;
  }

  addTable(headers: string[], rows: any[][], options?: any) {
    (this.doc as any).autoTable({
      startY: this.currentY,
      head: [headers],
      body: rows,
      theme: 'striped',
      margin: { left: 14, right: 14 },
      tableWidth: 'auto',
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
      styles: {
        overflow: 'linebreak',
        cellWidth: 'wrap',
        cellPadding: 2
      },
      ...options
    });

    this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
  }

  addTotals(items: { label: string; value: string; bold?: boolean }[]) {
    const startX = 125;

    this.currentY += 5;

    items.forEach((item, index) => {
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
      if (this.currentY > 270) {
        this.doc.addPage();
        this.currentY = 20;
      }
      this.doc.text(line, 20, this.currentY);
      this.currentY += 4;
    });

    this.currentY += 3;
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
