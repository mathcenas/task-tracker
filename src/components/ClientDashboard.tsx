import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { format, isToday, isTomorrow, isYesterday, startOfMonth, endOfMonth, isWithinInterval, subMonths, addMonths, parseISO } from 'date-fns';
import { Download, Plus, AlertTriangle, FileText, Pencil, Package, DollarSign, Clock, Calendar, ChevronLeft, ChevronRight, BarChart3, TrendingUp, Trash2, ChevronDown, ChevronUp, Users, CalendarDays } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { PDFExporter } from '../utils/pdfExport';
import { apiService } from '../services/api';
import { ClientYearlyRates } from './ClientYearlyRates';

export function ClientDashboard() {
  const { clients, getClientTasks, getProject, deleteClient, projects, updateClient } = useApp();
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showMultiMonthModal, setShowMultiMonthModal] = useState(false);
  const [multiMonthClient, setMultiMonthClient] = useState<any>(null);
  const [startMonth, setStartMonth] = useState(new Date());
  const [endMonth, setEndMonth] = useState(new Date());
  const [showProjectFilterModal, setShowProjectFilterModal] = useState(false);
  const [projectFilterClient, setProjectFilterClient] = useState<any>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [showEditClientModal, setShowEditClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [editClientData, setEditClientData] = useState({ name: '', email: '', hourlyRate: 0 });
  const [showYearlyRatesModal, setShowYearlyRatesModal] = useState(false);
  const [yearlyRatesClient, setYearlyRatesClient] = useState<any>(null);
  const navigate = useNavigate();

  const toggleClient = (clientId: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  const handleDeleteClient = async (clientId: string, clientName: string) => {
    const clientTasks = getClientTasks(clientId);
    const tasksCount = clientTasks.length;
    const confirmMessage = tasksCount > 0
      ? `Are you sure you want to delete "${clientName}"?\n\nThis will also delete ${tasksCount} associated task${tasksCount === 1 ? '' : 's'}.\n\nThis action cannot be undone.`
      : `Are you sure you want to delete "${clientName}"?\n\nThis action cannot be undone.`;

    if (window.confirm(confirmMessage)) {
      try {
        await deleteClient(clientId);
        setExpandedClients(prev => {
          const next = new Set(prev);
          next.delete(clientId);
          return next;
        });
        alert(`✅ Client "${clientName}" has been deleted successfully.`);
      } catch (error) {
        console.error('Error deleting client:', error);
        alert('❌ Failed to delete client. Please try again.');
      }
    }
  };

  const openEditClient = (client: any) => {
    setEditingClient(client);
    setEditClientData({
      name: client.name,
      email: client.email,
      hourlyRate: client.hourlyRate
    });
    setShowEditClientModal(true);
  };

  const handleSaveClient = async () => {
    if (!editingClient) return;

    try {
      await updateClient({
        ...editingClient,
        name: editClientData.name,
        email: editClientData.email,
        hourlyRate: editClientData.hourlyRate
      });
      setShowEditClientModal(false);
      alert('Client updated successfully!');
    } catch (error) {
      console.error('Failed to update client:', error);
      alert('Failed to update client');
    }
  };

  const openYearlyRates = (client: any) => {
    setYearlyRatesClient(client);
    setShowYearlyRatesModal(true);
  };

  const getRelativeDate = (date: string) => {
    const taskDate = new Date(date);
    if (isToday(taskDate)) return 'Today';
    if (isTomorrow(taskDate)) return 'Tomorrow';
    if (isYesterday(taskDate)) return 'Yesterday';
    return format(taskDate, 'MMM d, yyyy');
  };

  const getHourlyRateForYear = (client: any, year: number): number => {
    if (client.yearlyRates && client.yearlyRates.length > 0) {
      const yearRate = client.yearlyRates.find((r: any) => r.year === year);
      if (yearRate) {
        return yearRate.hourlyRate;
      }
    }
    return client.hourlyRate;
  };

  const exportMonthlyReport = async (clientData: any, clientTasks: any[], exportMonth = selectedMonth) => {
    try {
      console.log('📄 Starting PDF export for client:', clientData.name);
      const exportMonthStart = startOfMonth(exportMonth);
      const exportMonthEnd = endOfMonth(exportMonth);
      const exportTasks = clientTasks.filter(task =>
        task.finished &&
        isWithinInterval(new Date(task.date), { start: exportMonthStart, end: exportMonthEnd })
      );

      console.log('📊 Export tasks found:', exportTasks.length);
      const companySettings = await apiService.getCompanySettings();
      console.log('⚙️ Company settings loaded:', companySettings);
      const pdf = new PDFExporter(companySettings);
      console.log('✅ PDF Exporter initialized');

      const clientName = clientData.name;
      const monthYear = format(exportMonth, 'MMMM yyyy');
      const exportYear = exportMonth.getFullYear();
      const hourlyRate = getHourlyRateForYear(clientData, exportYear);
      const reportNumber = `RPT-${format(exportMonth, 'yyyyMM')}-${clientData.id.slice(-6)}`;

      await pdf.addHeader('Monthly Report');

      pdf.addSection('Report Details', {
        'Report Number': reportNumber,
        'Client': clientName,
        'Period': monthYear,
        'Generated': format(new Date(), 'MMM dd, yyyy'),
        'Service Rate': `$${hourlyRate.toFixed(2)}/hour`
      });

      const servicesTasks = exportTasks.filter(task => task.type !== 'insumos');
      const suppliesTasks = exportTasks.filter(task => task.type === 'insumos');

      if (servicesTasks.length > 0) {
        const servicesTableData = servicesTasks.map(task => [
          format(new Date(task.date), 'MMM d, yyyy'),
          getProject(task.projectId)?.name || '',
          task.type.charAt(0).toUpperCase() + task.type.slice(1),
          task.description,
          task.hours?.toString() || '',
          `$${(task.hours * hourlyRate).toFixed(2)}`
        ]);

        pdf.addTable(
          ['Date', 'Project', 'Type', 'Description', 'Hours', 'Amount'],
          servicesTableData,
          {
            columnStyles: {
              0: { cellWidth: 22 },
              1: { cellWidth: 'auto' },
              2: { cellWidth: 22 },
              3: { cellWidth: 'auto' },
              4: { cellWidth: 18, halign: 'center' },
              5: { cellWidth: 25, halign: 'right' }
            }
          }
        );
      }

      if (suppliesTasks.length > 0) {
        const suppliesTableData = suppliesTasks.map(task => [
          format(new Date(task.date), 'MMM d, yyyy'),
          getProject(task.projectId)?.name || '',
          task.description,
          `$${task.cost?.toFixed(2)}`
        ]);

        pdf.addTable(
          ['Date', 'Project', 'Description', 'Cost'],
          suppliesTableData,
          {
            headStyles: {
              fillColor: [156, 39, 176]
            },
            columnStyles: {
              0: { cellWidth: 22 },
              1: { cellWidth: 'auto' },
              2: { cellWidth: 'auto' },
              3: { cellWidth: 25, halign: 'right' }
            }
          }
        );
      }

      const incidentTasks = servicesTasks.filter(task => task.type === 'incident');
      const requestTasks = servicesTasks.filter(task => task.type === 'request');
      const incidentHours = incidentTasks.reduce((sum, task) => sum + (task.hours || 0), 0);
      const requestHours = requestTasks.reduce((sum, task) => sum + (task.hours || 0), 0);
      const incidentTotal = incidentHours * hourlyRate;
      const requestTotal = requestHours * hourlyRate;
      const servicesTotal = servicesTasks.reduce((sum, task) => sum + ((task.hours || 0) * hourlyRate), 0);
      const suppliesTotal = suppliesTasks.reduce((sum, task) => sum + (task.cost || 0), 0);
      const totalAmount = servicesTotal + suppliesTotal;

      if (incidentTasks.length > 0 || requestTasks.length > 0) {
        const breakdownData = [];
        if (incidentTasks.length > 0) {
          breakdownData.push([
            'Incidents',
            incidentTasks.length.toString(),
            `${incidentHours.toFixed(1)}h`,
            `$${incidentTotal.toFixed(2)}`,
            servicesTotal > 0 ? `${((incidentTotal / servicesTotal) * 100).toFixed(0)}%` : '0%'
          ]);
        }
        if (requestTasks.length > 0) {
          breakdownData.push([
            'Requests',
            requestTasks.length.toString(),
            `${requestHours.toFixed(1)}h`,
            `$${requestTotal.toFixed(2)}`,
            servicesTotal > 0 ? `${((requestTotal / servicesTotal) * 100).toFixed(0)}%` : '0%'
          ]);
        }

        pdf.addTable(
          ['Type', 'Tasks', 'Hours', 'Amount', '% of Services'],
          breakdownData,
          {
            theme: 'grid',
            headStyles: {
              fillColor: [100, 100, 100]
            },
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

      const totalServiceHours = servicesTasks.reduce((sum, task) => sum + (task.hours || 0), 0);

      pdf.addTotals([
        { label: 'Total Service Hours:', value: `${totalServiceHours.toFixed(2)}h` },
        { label: 'Services Total:', value: `$${servicesTotal.toFixed(2)}` },
        { label: 'Supplies Total:', value: `$${suppliesTotal.toFixed(2)}` },
        { label: 'Total Amount:', value: `$${totalAmount.toFixed(2)}`, bold: true }
      ]);

      pdf.addNotes('Thank you', 'Thank you for your business!');

      const filename = `${clientName.toLowerCase().replace(/\s+/g, '-')}-monthly-report-${format(exportMonth, 'yyyy-MM')}.pdf`;
      console.log('💾 Saving PDF as:', filename);
      pdf.save(filename);
      console.log('✅ PDF export completed successfully');
    } catch (error) {
      console.error('❌ Failed to generate monthly report:', error);
      alert(`Failed to generate PDF report: ${error.message || error}`);
    }
  };

  const previousMonth = () => {
    setSelectedMonth(prev => subMonths(prev, 1));
  };

  const nextMonth = () => {
    setSelectedMonth(prev => addMonths(prev, 1));
  };

  const goToCurrentMonth = () => {
    setSelectedMonth(new Date());
  };

  const openMultiMonthExport = (client: any) => {
    setMultiMonthClient(client);
    setStartMonth(subMonths(new Date(), 2));
    setEndMonth(new Date());
    setShowMultiMonthModal(true);
  };

  const openProjectFilterExport = (client: any) => {
    setProjectFilterClient(client);
    setSelectedProjectId('all');
    setShowProjectFilterModal(true);
  };

  const exportProjectFilteredReport = async () => {
    if (!projectFilterClient) return;

    try {
      const clientTasks = getClientTasks(projectFilterClient.id);
      console.log('🔍 All client tasks:', clientTasks.length);
      console.log('🔍 Client tasks:', clientTasks);

      let filteredTasks = clientTasks.filter(task => task.finished);
      console.log('✅ Completed tasks:', filteredTasks.length);
      console.log('✅ Completed tasks data:', filteredTasks);

      if (selectedProjectId !== 'all') {
        filteredTasks = filteredTasks.filter(task => task.projectId === selectedProjectId);
        console.log('📦 After project filter:', filteredTasks.length, 'for project:', selectedProjectId);
      }

      if (filteredTasks.length === 0) {
        alert('No completed tasks found for the selected project');
        return;
      }

      const sortedTasks = filteredTasks.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const firstTaskDate = sortedTasks[0].date;
      const lastTaskDate = sortedTasks[sortedTasks.length - 1].date;

      const companySettings = await apiService.getCompanySettings();
      const pdf = new PDFExporter(companySettings);

      const clientName = projectFilterClient.name;
      const hourlyRate = projectFilterClient.hourlyRate;
      const projectName = selectedProjectId === 'all' ? 'All Projects' : getProject(selectedProjectId)?.name || 'Unknown Project';
      const reportNumber = `RPT-PROJECT-${projectFilterClient.id.slice(-6)}${selectedProjectId !== 'all' ? '-' + selectedProjectId.slice(-4) : ''}`;
      const periodText = `${format(new Date(firstTaskDate), 'MMM d, yyyy')} - ${format(new Date(lastTaskDate), 'MMM d, yyyy')}`;

      await pdf.addHeader('Project Report');

      pdf.addSection('Report Details', {
        'Report Number': reportNumber,
        'Client': clientName,
        'Project': projectName,
        'Period': periodText,
        'Total Tasks': filteredTasks.length.toString(),
        'Generated': format(new Date(), 'MMM dd, yyyy'),
        'Service Rate': `$${hourlyRate.toFixed(2)}/hour`
      });

      const servicesTasks = filteredTasks.filter(task => task.type !== 'insumos');
      const suppliesTasks = filteredTasks.filter(task => task.type === 'insumos');

      if (servicesTasks.length > 0) {
        const servicesTableData = servicesTasks.map(task => [
          format(new Date(task.date), 'MMM d, yyyy'),
          getProject(task.projectId)?.name || '',
          task.type.charAt(0).toUpperCase() + task.type.slice(1),
          task.description,
          task.hours?.toString() || '',
          `$${(task.hours * hourlyRate).toFixed(2)}`
        ]);

        pdf.addTable(
          ['Date', 'Project', 'Type', 'Description', 'Hours', 'Amount'],
          servicesTableData,
          {
            columnStyles: {
              0: { cellWidth: 22 },
              1: { cellWidth: 'auto' },
              2: { cellWidth: 22 },
              3: { cellWidth: 'auto' },
              4: { cellWidth: 18, halign: 'center' },
              5: { cellWidth: 25, halign: 'right' }
            }
          }
        );
      }

      if (suppliesTasks.length > 0) {
        const suppliesTableData = suppliesTasks.map(task => [
          format(new Date(task.date), 'MMM d, yyyy'),
          getProject(task.projectId)?.name || '',
          task.description,
          `$${(task.cost || 0).toFixed(2)}`
        ]);

        pdf.addTable(
          ['Date', 'Project', 'Description', 'Cost'],
          suppliesTableData,
          {
            theme: 'grid',
            headStyles: {
              fillColor: [120, 53, 190]
            },
            columnStyles: {
              0: { cellWidth: 22 },
              1: { cellWidth: 'auto' },
              2: { cellWidth: 'auto' },
              3: { cellWidth: 25, halign: 'right' }
            }
          }
        );
      }

      const incidentTasks = servicesTasks.filter(task => task.type === 'incident');
      const requestTasks = servicesTasks.filter(task => task.type === 'request');
      const incidentHours = incidentTasks.reduce((sum, task) => sum + (task.hours || 0), 0);
      const requestHours = requestTasks.reduce((sum, task) => sum + (task.hours || 0), 0);
      const incidentTotal = incidentHours * hourlyRate;
      const requestTotal = requestHours * hourlyRate;
      const servicesTotal = servicesTasks.reduce((sum, task) => sum + ((task.hours || 0) * hourlyRate), 0);
      const suppliesTotal = suppliesTasks.reduce((sum, task) => sum + (task.cost || 0), 0);
      const totalAmount = servicesTotal + suppliesTotal;

      if (incidentTasks.length > 0 || requestTasks.length > 0) {
        const breakdownData = [];
        if (incidentTasks.length > 0) {
          breakdownData.push([
            'Incidents',
            incidentTasks.length.toString(),
            `${incidentHours.toFixed(1)}h`,
            `$${incidentTotal.toFixed(2)}`,
            servicesTotal > 0 ? `${((incidentTotal / servicesTotal) * 100).toFixed(0)}%` : '0%'
          ]);
        }
        if (requestTasks.length > 0) {
          breakdownData.push([
            'Requests',
            requestTasks.length.toString(),
            `${requestHours.toFixed(1)}h`,
            `$${requestTotal.toFixed(2)}`,
            servicesTotal > 0 ? `${((requestTotal / servicesTotal) * 100).toFixed(0)}%` : '0%'
          ]);
        }

        pdf.addTable(
          ['Type', 'Tasks', 'Hours', 'Amount', '% of Services'],
          breakdownData,
          {
            theme: 'grid',
            headStyles: {
              fillColor: [100, 100, 100]
            },
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

      const totalServiceHours = servicesTasks.reduce((sum, task) => sum + (task.hours || 0), 0);

      pdf.addTotals([
        { label: 'Total Service Hours:', value: `${totalServiceHours.toFixed(2)}h` },
        { label: 'Services Total:', value: `$${servicesTotal.toFixed(2)}` },
        { label: 'Supplies Total:', value: `$${suppliesTotal.toFixed(2)}` },
        { label: 'Total Amount:', value: `$${totalAmount.toFixed(2)}`, bold: true }
      ]);

      pdf.addNotes('Thank you', 'Thank you for your business!');

      const projectSlug = selectedProjectId === 'all' ? 'all-projects' : projectName.toLowerCase().replace(/\s+/g, '-');
      const filename = `${clientName.toLowerCase().replace(/\s+/g, '-')}-${projectSlug}-complete.pdf`;
      pdf.save(filename);

      setShowProjectFilterModal(false);
      alert('Project report generated successfully!');
    } catch (error) {
      console.error('Failed to generate project-filtered report:', error);
      alert('Failed to generate PDF report');
    }
  };

  const exportMultiMonthReport = async () => {
    if (!multiMonthClient) return;

    try {
      const start = startOfMonth(startMonth);
      const end = endOfMonth(endMonth);

      if (start > end) {
        alert('Start month must be before or equal to end month');
        return;
      }

      const clientTasks = getClientTasks(multiMonthClient.id);
      const filteredTasks = clientTasks.filter(task => {
        if (!task.finished) return false;
        const taskDate = parseISO(task.date + 'T00:00:00');
        return isWithinInterval(taskDate, { start, end });
      });

      if (filteredTasks.length === 0) {
        alert('No completed tasks found in the selected date range');
        return;
      }

      const companySettings = await apiService.getCompanySettings();
      const pdf = new PDFExporter(companySettings);

      const clientName = multiMonthClient.name;
      const dateRange = `${format(start, 'MMM yyyy')} - ${format(end, 'MMM yyyy')}`;
      const reportNumber = `RPT-${format(start, 'yyyyMM')}-${format(end, 'yyyyMM')}-${multiMonthClient.id.slice(-6)}`;

      const uniqueYears = [...new Set(filteredTasks.map(task => new Date(task.date).getFullYear()))].sort();
      const yearlyRatesUsed = uniqueYears.map(year => ({
        year,
        rate: getHourlyRateForYear(multiMonthClient, year)
      }));

      await pdf.addHeader('Multi-Month Report');

      const ratesDisplay = yearlyRatesUsed.length > 1
        ? yearlyRatesUsed.map(yr => `${yr.year}: $${yr.rate.toFixed(2)}/hour`).join(', ')
        : `$${yearlyRatesUsed[0]?.rate.toFixed(2)}/hour`;

      pdf.addSection('Report Details', {
        'Report Number': reportNumber,
        'Client': clientName,
        'Period': dateRange,
        'Generated': format(new Date(), 'MMM dd, yyyy'),
        'Service Rate(s)': ratesDisplay
      });

      const servicesTasks = filteredTasks.filter(task => task.type !== 'insumos');
      const suppliesTasks = filteredTasks.filter(task => task.type === 'insumos');

      if (servicesTasks.length > 0) {
        const servicesTableData = servicesTasks.map(task => {
          const taskYear = new Date(task.date).getFullYear();
          const taskRate = getHourlyRateForYear(multiMonthClient, taskYear);
          return [
            format(new Date(task.date), 'MMM d, yyyy'),
            getProject(task.projectId)?.name || '',
            task.type.charAt(0).toUpperCase() + task.type.slice(1),
            task.description,
            task.hours?.toString() || '',
            `$${(task.hours * taskRate).toFixed(2)}`
          ];
        });

        pdf.addTable(
          ['Date', 'Project', 'Type', 'Description', 'Hours', 'Amount'],
          servicesTableData,
          {
            columnStyles: {
              0: { cellWidth: 22 },
              1: { cellWidth: 'auto' },
              2: { cellWidth: 22 },
              3: { cellWidth: 'auto' },
              4: { cellWidth: 18, halign: 'center' },
              5: { cellWidth: 25, halign: 'right' }
            }
          }
        );
      }

      if (suppliesTasks.length > 0) {
        const suppliesTableData = suppliesTasks.map(task => [
          format(new Date(task.date), 'MMM d, yyyy'),
          getProject(task.projectId)?.name || '',
          task.description,
          `$${(task.cost || 0).toFixed(2)}`
        ]);

        pdf.addTable(
          ['Date', 'Project', 'Description', 'Cost'],
          suppliesTableData,
          {
            theme: 'grid',
            headStyles: {
              fillColor: [120, 53, 190]
            },
            columnStyles: {
              0: { cellWidth: 22 },
              1: { cellWidth: 'auto' },
              2: { cellWidth: 'auto' },
              3: { cellWidth: 25, halign: 'right' }
            }
          }
        );
      }

      const incidentTasks = servicesTasks.filter(task => task.type === 'incident');
      const requestTasks = servicesTasks.filter(task => task.type === 'request');
      const incidentHours = incidentTasks.reduce((sum, task) => sum + (task.hours || 0), 0);
      const requestHours = requestTasks.reduce((sum, task) => sum + (task.hours || 0), 0);

      // Calculate totals using year-specific rates
      const incidentTotal = incidentTasks.reduce((sum, task) => {
        const taskYear = new Date(task.date).getFullYear();
        const taskRate = getHourlyRateForYear(multiMonthClient, taskYear);
        return sum + ((task.hours || 0) * taskRate);
      }, 0);

      const requestTotal = requestTasks.reduce((sum, task) => {
        const taskYear = new Date(task.date).getFullYear();
        const taskRate = getHourlyRateForYear(multiMonthClient, taskYear);
        return sum + ((task.hours || 0) * taskRate);
      }, 0);

      const servicesTotal = servicesTasks.reduce((sum, task) => {
        const taskYear = new Date(task.date).getFullYear();
        const taskRate = getHourlyRateForYear(multiMonthClient, taskYear);
        return sum + ((task.hours || 0) * taskRate);
      }, 0);

      const suppliesTotal = suppliesTasks.reduce((sum, task) => sum + (task.cost || 0), 0);
      const totalAmount = servicesTotal + suppliesTotal;

      if (incidentTasks.length > 0 || requestTasks.length > 0) {
        const breakdownData = [];
        if (incidentTasks.length > 0) {
          breakdownData.push([
            'Incidents',
            incidentTasks.length.toString(),
            `${incidentHours.toFixed(1)}h`,
            `$${incidentTotal.toFixed(2)}`,
            servicesTotal > 0 ? `${((incidentTotal / servicesTotal) * 100).toFixed(0)}%` : '0%'
          ]);
        }
        if (requestTasks.length > 0) {
          breakdownData.push([
            'Requests',
            requestTasks.length.toString(),
            `${requestHours.toFixed(1)}h`,
            `$${requestTotal.toFixed(2)}`,
            servicesTotal > 0 ? `${((requestTotal / servicesTotal) * 100).toFixed(0)}%` : '0%'
          ]);
        }

        pdf.addTable(
          ['Type', 'Tasks', 'Hours', 'Amount', '% of Services'],
          breakdownData,
          {
            theme: 'grid',
            headStyles: {
              fillColor: [100, 100, 100]
            },
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

      const totalServiceHours = servicesTasks.reduce((sum, task) => sum + (task.hours || 0), 0);

      pdf.addTotals([
        { label: 'Total Service Hours:', value: `${totalServiceHours.toFixed(2)}h` },
        { label: 'Services Total:', value: `$${servicesTotal.toFixed(2)}` },
        { label: 'Supplies Total:', value: `$${suppliesTotal.toFixed(2)}` },
        { label: 'Total Amount:', value: `$${totalAmount.toFixed(2)}`, bold: true }
      ]);

      pdf.addNotes('Thank you', 'Thank you for your business!');

      const filename = `${clientName.toLowerCase().replace(/\s+/g, '-')}-report-${format(start, 'yyyy-MM')}-to-${format(end, 'yyyy-MM')}.pdf`;
      pdf.save(filename);

      setShowMultiMonthModal(false);
      alert('Multi-month report generated successfully!');
    } catch (error) {
      console.error('Failed to generate multi-month report:', error);
      alert('Failed to generate PDF report');
    }
  };

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'incident':
        return <AlertTriangle className="w-5 h-5 text-red-500 mt-1" />;
      case 'insumos':
        return <Package className="w-5 h-5 text-purple-500 mt-1" />;
      default:
        return <FileText className="w-5 h-5 text-blue-500 mt-1" />;
    }
  };

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);

  const totalClients = clients.length;
  const activeClients = clients.filter(c => {
    const clientTasks = getClientTasks(c.id);
    const monthlyTasks = clientTasks.filter(task =>
      task.finished &&
      isWithinInterval(parseISO(task.date), { start: monthStart, end: monthEnd })
    );
    return monthlyTasks.length > 0;
  }).length;

  const totalMonthlyRevenue = clients.reduce((sum, client) => {
    const clientTasks = getClientTasks(client.id);
    const monthlyTasks = clientTasks.filter(task =>
      task.finished &&
      isWithinInterval(parseISO(task.date), { start: monthStart, end: monthEnd })
    );
    const hours = monthlyTasks.filter(t => t.type !== 'insumos').reduce((s, t) => s + (t.hours || 0), 0);
    return sum + (hours * client.hourlyRate);
  }, 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Client Dashboard</h2>
        <Link
          to="/add-client"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Client
        </Link>
      </div>

      {/* Month Navigator */}
      <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={previousMonth}
              className="p-2 hover:bg-gray-100 rounded-full dark:hover:bg-gray-700 transition-colors"
              title="Previous month"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
            <div className="text-center min-w-[150px]">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                {format(selectedMonth, 'MMMM yyyy')}
              </h4>
            </div>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-gray-100 rounded-full dark:hover:bg-gray-700 transition-colors"
              title="Next month"
            >
              <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
          </div>
          {!isWithinInterval(new Date(), { start: monthStart, end: monthEnd }) && (
            <button
              onClick={goToCurrentMonth}
              className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              Current Month
            </button>
          )}
        </div>
      </div>

      {/* Clients List */}
      <div className="space-y-4">
        {clients.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 p-12 text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No clients yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Get started by adding your first client</p>
            <Link
              to="/add-client"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Client
            </Link>
          </div>
        ) : (
          clients.map(client => {
            const allClientTasks = getClientTasks(client.id);
            const monthlyTasks = allClientTasks.filter(task =>
              task.finished &&
              isWithinInterval(parseISO(task.date), { start: monthStart, end: monthEnd })
            );

            const clientStats = monthlyTasks.reduce((stats, task) => {
              if (task.type === 'insumos') {
                stats.suppliesCost += task.cost || 0;
                stats.suppliesCount += 1;
              } else {
                stats.totalHours += task.hours || 0;
                stats.serviceRevenue += (task.hours || 0) * client.hourlyRate;

                if (task.type === 'incident') {
                  stats.incidentHours += task.hours || 0;
                  stats.incidentCount += 1;
                } else {
                  stats.requestHours += task.hours || 0;
                  stats.requestCount += 1;
                }
              }
              return stats;
            }, {
              totalHours: 0,
              serviceRevenue: 0,
              suppliesCost: 0,
              suppliesCount: 0,
              incidentHours: 0,
              incidentCount: 0,
              requestHours: 0,
              requestCount: 0
            });

            const trendData = Array.from({ length: 6 }, (_, i) => {
              const month = subMonths(selectedMonth, 5 - i);
              const monthTasks = allClientTasks.filter(task =>
                task.finished &&
                isWithinInterval(parseISO(task.date), { start: startOfMonth(month), end: endOfMonth(month) })
              );
              const hours = monthTasks.filter(t => t.type !== 'insumos').reduce((sum, task) => sum + (task.hours || 0), 0);
              const revenue = hours * client.hourlyRate;

              return {
                month: format(month, 'MMM'),
                hours,
                revenue,
                tasks: monthTasks.length
              };
            });

            const isExpanded = expandedClients.has(client.id);
            const hasActivity = monthlyTasks.length > 0;

            return (
              <div key={client.id} className="bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Client Header - Always Visible */}
                <div
                  className="p-6 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  onClick={() => toggleClient(client.id)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        {client.name}
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        ${client.hourlyRate}/hour • {allClientTasks.length} total tasks
                      </p>
                    </div>
                    {hasActivity && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        Active
                      </span>
                    )}
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Hours</p>
                      <p className="text-lg font-bold text-blue-900 dark:text-blue-300">
                        {clientStats.totalHours.toFixed(1)}h
                      </p>
                    </div>
                    <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <p className="text-xs text-green-600 dark:text-green-400 mb-1">Revenue</p>
                      <p className="text-lg font-bold text-green-900 dark:text-green-300">
                        ${clientStats.serviceRevenue.toFixed(0)}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Tasks</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {monthlyTasks.length}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-6 space-y-6">
                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const year = selectedMonth.getFullYear();
                          const month = selectedMonth.getMonth() + 1;

                          if (!client.slug) {
                            alert(`❌ Error: Client slug not found for "${client.name}".`);
                            return;
                          }

                          const url = `${window.location.origin}/report/${client.slug}/${year}/${month}`;
                          navigator.clipboard.writeText(url);
                          alert(`✅ Client report URL copied!\n\n${url}`);
                        }}
                        className="inline-flex items-center px-3 py-2 border border-blue-300 rounded-lg shadow-sm text-sm font-medium text-blue-700 bg-white hover:bg-blue-50 dark:border-blue-600 dark:bg-gray-800 dark:text-blue-400 dark:hover:bg-blue-900/20"
                      >
                        <Calendar className="w-4 h-4 mr-2" />
                        Copy Client URL
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          exportMonthlyReport(client, allClientTasks, selectedMonth);
                        }}
                        disabled={monthlyTasks.length === 0}
                        className="inline-flex items-center px-3 py-2 border border-green-300 rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export PDF
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openMultiMonthExport(client);
                        }}
                        disabled={allClientTasks.length === 0}
                        className="inline-flex items-center px-3 py-2 border border-purple-300 rounded-lg shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Multi-Month Export
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openProjectFilterExport(client);
                        }}
                        disabled={allClientTasks.filter(t => t.finished).length === 0}
                        className="inline-flex items-center px-3 py-2 border border-teal-300 rounded-lg shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        <Package className="w-4 h-4 mr-2" />
                        Export by Project
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openYearlyRates(client);
                        }}
                        className="inline-flex items-center px-3 py-2 border border-blue-300 rounded-lg shadow-sm text-sm font-medium text-blue-700 bg-white hover:bg-blue-50 dark:border-blue-700 dark:bg-gray-800 dark:text-blue-400 dark:hover:bg-blue-900/20"
                        title="Manage yearly hourly rates"
                      >
                        <CalendarDays className="w-4 h-4 mr-2" />
                        Yearly Rates
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditClient(client);
                        }}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClient(client.id, client.name);
                        }}
                        className="inline-flex items-center px-3 py-2 border border-red-300 rounded-lg shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </button>
                    </div>

                    {/* Service Type Breakdown */}
                    {(clientStats.incidentCount > 0 || clientStats.requestCount > 0) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-red-50 p-4 rounded-lg dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center">
                              <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
                              <div>
                                <p className="text-sm font-semibold text-red-700 dark:text-red-400">Incidents</p>
                                <p className="text-xs text-red-600 dark:text-red-500">{clientStats.incidentCount} tasks</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-semibold text-red-900 dark:text-red-300">{clientStats.incidentHours.toFixed(1)}h</p>
                              <p className="text-sm text-red-600 dark:text-red-400">
                                ${(clientStats.incidentHours * client.hourlyRate).toFixed(0)}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-blue-50 p-4 rounded-lg dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center">
                              <FileText className="w-5 h-5 text-blue-500 mr-2" />
                              <div>
                                <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">Requests</p>
                                <p className="text-xs text-blue-600 dark:text-blue-500">{clientStats.requestCount} tasks</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-semibold text-blue-900 dark:text-blue-300">{clientStats.requestHours.toFixed(1)}h</p>
                              <p className="text-sm text-blue-600 dark:text-blue-400">
                                ${(clientStats.requestHours * client.hourlyRate).toFixed(0)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 6-Month Trend */}
                    {trendData.some(d => d.hours > 0) && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                          <BarChart3 className="w-4 h-4 text-blue-500 mr-2" />
                          6-Month Trend
                        </h4>
                        <div className="grid grid-cols-6 gap-2">
                          {trendData.map((data, index) => {
                            const maxHours = Math.max(...trendData.map(d => d.hours));
                            const height = maxHours > 0 ? (data.hours / maxHours) * 100 : 0;
                            const isCurrentMonth = index === 5;

                            return (
                              <div key={data.month} className="text-center">
                                <div className="h-20 flex items-end justify-center mb-2">
                                  <div
                                    className={`w-6 rounded-t transition-all ${
                                      isCurrentMonth
                                        ? 'bg-blue-500'
                                        : data.hours > 0
                                        ? 'bg-gray-400 dark:bg-gray-500'
                                        : 'bg-gray-200 dark:bg-gray-600'
                                    }`}
                                    style={{ height: `${height}%` }}
                                  />
                                </div>
                                <p className={`text-xs ${isCurrentMonth ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                                  {data.month}
                                </p>
                                <p className="text-xs font-medium text-gray-900 dark:text-white">
                                  {data.hours.toFixed(1)}h
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Monthly Tasks List */}
                    {monthlyTasks.length > 0 ? (
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                          Tasks for {format(selectedMonth, 'MMMM yyyy')}
                        </h4>
                        {monthlyTasks
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .slice(0, 10)
                          .map(task => {
                            const project = getProject(task.projectId);

                            return (
                              <div key={task.id} className="border rounded-lg p-4 hover:bg-white dark:border-gray-700 dark:hover:bg-gray-800 transition-all group bg-gray-50 dark:bg-gray-900">
                                <div className="flex justify-between items-start">
                                  <div className="flex items-start space-x-3 flex-1">
                                    {getTaskIcon(task.type)}
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-2 mb-1">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">{project?.name}</p>
                                        <span className="text-sm text-gray-500 dark:text-gray-400">•</span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                          {getRelativeDate(task.date)}
                                        </span>
                                      </div>
                                      <p className="text-sm text-gray-600 dark:text-gray-300">{task.description}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-3">
                                    <div className="text-right">
                                      {task.type === 'insumos' ? (
                                        <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                                          ${task.cost?.toFixed(2)}
                                        </p>
                                      ) : (
                                        <>
                                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                                            {task.hours?.toFixed(1)}h
                                          </p>
                                          <p className="text-sm text-green-600 dark:text-green-400">
                                            ${((task.hours || 0) * client.hourlyRate).toFixed(2)}
                                          </p>
                                        </>
                                      )}
                                    </div>
                                    <Link
                                      to={`/edit-task/${task.id}`}
                                      state={{ from: '/clients' }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="p-2 hover:bg-gray-200 rounded-lg dark:hover:bg-gray-700 transition-colors opacity-0 group-hover:opacity-100"
                                      title="Edit task"
                                    >
                                      <Pencil className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                    </Link>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        {monthlyTasks.length > 10 && (
                          <p className="text-sm text-center text-gray-500 dark:text-gray-400 pt-2">
                            +{monthlyTasks.length - 10} more tasks
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
                        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">No completed tasks this month</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {showMultiMonthModal && multiMonthClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Multi-Month Export
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Export report for {multiMonthClient.name}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Start Month
                </label>
                <input
                  type="month"
                  value={format(startMonth, 'yyyy-MM')}
                  onChange={(e) => setStartMonth(new Date(e.target.value + '-01'))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  End Month
                </label>
                <input
                  type="month"
                  value={format(endMonth, 'yyyy-MM')}
                  onChange={(e) => setEndMonth(new Date(e.target.value + '-01'))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  Period: {format(startMonth, 'MMM yyyy')} - {format(endMonth, 'MMM yyyy')}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowMultiMonthModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={exportMultiMonthReport}
                className="flex-1 px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
              >
                <Download className="w-4 h-4 inline mr-2" />
                Export
              </button>
            </div>
          </div>
        </div>
      )}

      {showProjectFilterModal && projectFilterClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Export Complete Project Report
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Export all completed tasks for {projectFilterClient.name}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Project
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="all">All Projects</option>
                  {projects
                    .filter(p => p.clientId === projectFilterClient.id)
                    .map(project => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Package className="w-5 h-5 text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-teal-900 dark:text-teal-200 mb-1">
                      Complete Project History
                    </p>
                    <p className="text-xs text-teal-700 dark:text-teal-300">
                      This will export all completed tasks from the project's entire lifetime, from the first task to the most recent one.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowProjectFilterModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={exportProjectFilteredReport}
                className="flex-1 px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-teal-600 hover:bg-teal-700"
              >
                <Download className="w-4 h-4 inline mr-2" />
                Export Complete Report
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditClientModal && editingClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Edit Client
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Update client information
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Client Name
                </label>
                <input
                  type="text"
                  value={editClientData.name}
                  onChange={(e) => setEditClientData({ ...editClientData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={editClientData.email}
                  onChange={(e) => setEditClientData({ ...editClientData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Hourly Rate
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    value={editClientData.hourlyRate}
                    onChange={(e) => setEditClientData({ ...editClientData, hourlyRate: parseFloat(e.target.value) || 0 })}
                    min="0"
                    step="0.01"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditClientModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveClient}
                className="flex-1 px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {showYearlyRatesModal && yearlyRatesClient && (
        <ClientYearlyRates
          clientId={yearlyRatesClient.id}
          clientName={yearlyRatesClient.name}
          defaultHourlyRate={yearlyRatesClient.hourlyRate}
          onClose={() => setShowYearlyRatesModal(false)}
        />
      )}
    </div>
  );
}
