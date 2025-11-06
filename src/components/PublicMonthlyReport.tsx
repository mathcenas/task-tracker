import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, isWithinInterval, isAfter, endOfDay, subMonths, addMonths, parseISO } from 'date-fns';
import { Clock, AlertTriangle, FileText, Package, DollarSign, Calendar, Download, ChevronLeft, ChevronRight, BarChart3, TrendingUp } from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { exportMonthlyReportToCSV } from '../utils/csvExport';
import { Client, Project, Task } from '../types';

export function PublicMonthlyReport() {
  const { clientSlug, year, month } = useParams<{ clientSlug: string; year: string; month: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allTasks, setAllTasks] = useState<Task[]>([]);

  // Load report data from public API (including 6 months of data for trend)
  useEffect(() => {
    const loadReportData = async () => {
      if (!clientSlug || !year || !month) return;

      setLoading(true);
      setError(null);

      try {
        const apiUrl = import.meta.env.MODE === 'production' ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:3000');

        // Load current month data
        const response = await fetch(`${apiUrl}/api/public/client-report/${clientSlug}/${year}/${month}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError('not_found');
          } else {
            setError('server_error');
          }
          return;
        }

        const data = await response.json();
        setClient(data.client);
        setTasks(data.tasks);
        setProjects(data.projects);

        // Load 6 months of data for trend chart
        const currentDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const trendPromises = [];

        for (let i = 5; i >= 0; i--) {
          const trendDate = subMonths(currentDate, i);
          const trendYear = trendDate.getFullYear();
          const trendMonth = trendDate.getMonth() + 1;

          trendPromises.push(
            fetch(`${apiUrl}/api/public/client-report/${clientSlug}/${trendYear}/${trendMonth}`)
              .then(res => res.ok ? res.json() : { tasks: [] })
              .catch(() => ({ tasks: [] }))
          );
        }

        const trendResults = await Promise.all(trendPromises);
        const allTasksData = trendResults.flatMap(result => result.tasks || []);
        setAllTasks(allTasksData);

      } catch (err) {
        console.error('Error loading report data:', err);
        setError('network_error');
      } finally {
        setLoading(false);
      }
    };

    loadReportData();
  }, [clientSlug, year, month]);

  // Handle missing parameters
  if (!clientSlug || !year || !month) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-lg mx-auto mb-6 dark:bg-red-900/20">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Invalid Report URL</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            The URL format should be: <br />
            <code className="bg-gray-100 px-2 py-1 rounded text-sm dark:bg-gray-800">
              /report/client-name/year/month
            </code>
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Example: /report/acme-corp/2025/1
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading report...</p>
        </div>
      </div>
    );
  }
  
  // If client not found, show access denied (no client info exposed)
  if (!client) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-md border border-gray-200 dark:border-gray-700 p-8 dark:bg-gray-800">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center w-16 h-16 bg-blue-600 rounded-lg mx-auto mb-6">
                <Clock className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">TaskTracker Pro</h1>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Access Denied
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                The requested client report could not be found or you don't have access to view it.
              </p>
              <div className="mt-6 p-4 bg-red-50 rounded-lg dark:bg-red-900/20">
                <p className="text-sm text-red-800 dark:text-red-300">
                  <strong>Error:</strong> Client report not accessible
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                  Please contact your service provider if you believe this is an error.
                </p>
              </div>
              
              <div className="mt-8">
                <a
                  href="https://github.com/yourusername/tasktracker-pro"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Learn About TaskTracker Pro
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Guard: Ensure client data is loaded before computing stats
  if (!client) {
    return null;
  }

  const reportDate = new Date(parseInt(year), parseInt(month) - 1, 1);
  const monthStart = startOfMonth(reportDate);
  const monthEnd = endOfMonth(reportDate);
  const today = new Date();

  // Tasks are already filtered by the API, but we have them in state
  const monthlyTasks = tasks;

  console.log('🌐 Public Report - data loaded:', {
    clientSlug,
    year,
    month,
    monthStart: format(monthStart, 'yyyy-MM-dd'),
    monthEnd: format(monthEnd, 'yyyy-MM-dd'),
    tasks: tasks.length,
    projects: projects.length
  });

  // Report is always available for valid clients, even without completed tasks
  const isReportAvailable = true;

  // Build 6-month trend data
  const trendData = [];
  for (let i = 5; i >= 0; i--) {
    const trendDate = subMonths(reportDate, i);
    const trendMonthStart = startOfMonth(trendDate);
    const trendMonthEnd = endOfMonth(trendDate);

    // Filter tasks for this specific month
    const monthTasks = allTasks.filter(task => {
      const taskDate = new Date(task.date);
      return isWithinInterval(taskDate, { start: trendMonthStart, end: trendMonthEnd });
    });

    const incidentHours = monthTasks.filter(t => t.type === 'incident').reduce((sum, task) => sum + (task.hours || 0), 0);
    const requestHours = monthTasks.filter(t => t.type === 'request').reduce((sum, task) => sum + (task.hours || 0), 0);
    const hours = incidentHours + requestHours;

    trendData.push({
      month: format(trendDate, 'MMM'),
      year: trendDate.getFullYear(),
      monthNum: trendDate.getMonth() + 1,
      hours,
      incidentHours,
      requestHours,
      revenue: hours * client.hourlyRate,
      tasks: monthTasks.length
    });
  }

  // Current month stats for the main report
  const incidentHours = monthlyTasks.filter(t => t.type === 'incident').reduce((sum, task) => sum + (task.hours || 0), 0);
  const requestHours = monthlyTasks.filter(t => t.type === 'request').reduce((sum, task) => sum + (task.hours || 0), 0);
  const hours = incidentHours + requestHours;
  const revenue = hours * client.hourlyRate;

  // Helper function to get project by ID
  const getProject = (projectId: string) => {
    return projects.find(p => p.id === projectId);
  };

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

  const exportPDF = () => {
    if (!client || !year || !month) return;

    const doc = new jsPDF();
    const clientName = client.name;
    const monthYear = format(reportDate, 'MMMM yyyy');
    const hourlyRate = client.hourlyRate;

    // Add company logo/header
    doc.setFillColor(41, 98, 255);
    doc.roundedRect(15, 10, 12, 12, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text('⏰', 19, 18);

    doc.setFontSize(24);
    doc.setTextColor(41, 98, 255);
    doc.text('TaskTracker Pro', 35, 20);

    doc.setFontSize(20);
    doc.setTextColor(0, 0, 0);
    doc.text('MONTHLY REPORT', 35, 40);
    const reportNumber = `RPT-${year}${month.toString().padStart(2, '0')}-${client.id.slice(-6)}`;
    doc.setFontSize(12);
    doc.text(`Report #: ${reportNumber}`, 35, 50);
    
    const clientDetails = [
      `Client: ${clientName}`,
      `Period: ${monthYear}`,
      `Generated: ${format(new Date(), 'MMM dd, yyyy')}`,
      `Service Rate: $${hourlyRate.toFixed(2)}/hour`
    ];
    
    let yPos = 70;
    clientDetails.forEach(detail => {
      doc.text(detail, 20, yPos);
      yPos += 10;
    });

    const servicesTasks = monthlyTasks.filter(task => task.type !== 'insumos');
    const suppliesTasks = monthlyTasks.filter(task => task.type === 'insumos');

    if (servicesTasks.length > 0) {
      doc.setFontSize(14);
      doc.text('Services', 20, yPos + 10);

      const servicesTableData = servicesTasks.map(task => [
        format(new Date(task.date), 'MMM d, yyyy'),
        getProject(task.projectId)?.name || '',
        task.type.charAt(0).toUpperCase() + task.type.slice(1),
        task.description,
        task.hours?.toString() || '',
        `$${((task.hours || 0) * hourlyRate).toFixed(2)}`
      ]);

      (doc as any).autoTable({
        startY: yPos + 15,
        head: [['Date', 'Project', 'Type', 'Description', 'Hours', 'Amount']],
        body: servicesTableData,
        theme: 'striped',
        headStyles: { 
          fillColor: [41, 98, 255],
          textColor: [255, 255, 255]
        },
        columnStyles: {
          0: { cellWidth: 25 },
          3: { cellWidth: 60 },
          4: { cellWidth: 20 },
          5: { cellWidth: 25 }
        }
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    if (suppliesTasks.length > 0) {
      doc.setFontSize(14);
      doc.text('Supplies (Insumos)', 20, yPos + 10);

      const suppliesTableData = suppliesTasks.map(task => [
        format(new Date(task.date), 'MMM d, yyyy'),
        getProject(task.projectId)?.name || '',
        task.description,
        `$${task.cost?.toFixed(2)}`
      ]);

      (doc as any).autoTable({
        startY: yPos + 15,
        head: [['Date', 'Project', 'Description', 'Cost']],
        body: suppliesTableData,
        theme: 'striped',
        headStyles: { 
          fillColor: [156, 39, 176],
          textColor: [255, 255, 255]
        },
        columnStyles: {
          0: { cellWidth: 25 },
          2: { cellWidth: 100 },
          3: { cellWidth: 25 }
        }
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // Calculate totals and breakdown
    const incidentTasks = servicesTasks.filter(task => task.type === 'incident');
    const requestTasks = servicesTasks.filter(task => task.type === 'request');

    const incidentHours = incidentTasks.reduce((sum, task) => sum + (task.hours || 0), 0);
    const requestHours = requestTasks.reduce((sum, task) => sum + (task.hours || 0), 0);
    const incidentTotal = incidentHours * hourlyRate;
    const requestTotal = requestHours * hourlyRate;

    const servicesTotal = servicesTasks.reduce((sum, task) =>
      sum + ((task.hours || 0) * hourlyRate), 0);
    const suppliesTotal = suppliesTasks.reduce((sum, task) =>
      sum + (task.cost || 0), 0);
    const totalAmount = servicesTotal + suppliesTotal;

    // Add Service Type Breakdown (if there are incidents and requests)
    if (incidentTasks.length > 0 || requestTasks.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('Service Type Breakdown', 20, yPos + 10);

      const breakdownData = [];
      if (incidentTasks.length > 0) {
        breakdownData.push([
          '🚨 Incidents',
          incidentTasks.length.toString(),
          `${incidentHours.toFixed(1)}h`,
          `$${incidentTotal.toFixed(2)}`,
          servicesTotal > 0 ? `${((incidentTotal / servicesTotal) * 100).toFixed(0)}%` : '0%'
        ]);
      }
      if (requestTasks.length > 0) {
        breakdownData.push([
          '📋 Requests',
          requestTasks.length.toString(),
          `${requestHours.toFixed(1)}h`,
          `$${requestTotal.toFixed(2)}`,
          servicesTotal > 0 ? `${((requestTotal / servicesTotal) * 100).toFixed(0)}%` : '0%'
        ]);
      }

      (doc as any).autoTable({
        startY: yPos + 15,
        head: [['Type', 'Tasks', 'Hours', 'Amount', '% of Services']],
        body: breakdownData,
        theme: 'grid',
        headStyles: {
          fillColor: [100, 100, 100],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { cellWidth: 40, fontStyle: 'bold' },
          1: { cellWidth: 25, halign: 'center' },
          2: { cellWidth: 30, halign: 'center' },
          3: { cellWidth: 35, halign: 'right' },
          4: { cellWidth: 35, halign: 'center' }
        }
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    doc.setFontSize(12);
    const summary = [
      `Total Service Hours: ${servicesTasks.reduce((sum, task) => sum + (task.hours || 0), 0).toFixed(2)}`,
      `Services Total: $${servicesTotal.toFixed(2)}`,
      `Supplies Total: $${suppliesTotal.toFixed(2)}`,
      `Total Amount: $${totalAmount.toFixed(2)}`
    ];

    yPos += 10;
    summary.forEach((line, index) => {
      const fontSize = index === summary.length - 1 ? 14 : 12;
      const fontStyle = index === summary.length - 1 ? 'bold' : 'normal';
      doc.setFontSize(fontSize);
      doc.setFont(undefined, fontStyle);
      doc.text(line, 20, yPos);
      yPos += 10;
    });

    const footerText = 'Thank you for your business!';
    doc.setFontSize(10);
    doc.setTextColor(128, 128, 128);
    doc.text(footerText, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });

    doc.save(`${clientName.toLowerCase().replace(/\s+/g, '-')}-report-${year}-${month.padStart(2, '0')}.pdf`);
  };

  const previousMonth = () => {
    const prevMonth = subMonths(reportDate, 1);
    const newYear = prevMonth.getFullYear();
    const newMonth = prevMonth.getMonth() + 1;
    window.location.href = `/report/${clientSlug}/${newYear}/${newMonth}`;
  };

  const nextMonth = () => {
    const nextMonth = addMonths(reportDate, 1);
    const newYear = nextMonth.getFullYear();
    const newMonth = nextMonth.getMonth() + 1;
    window.location.href = `/report/${clientSlug}/${newYear}/${newMonth}`;
  };

  const goToCurrentMonth = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    window.location.href = `/report/${clientSlug}/${currentYear}/${currentMonth}`;
  };

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'incident':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'insumos':
        return <Package className="w-5 h-5 text-purple-500" />;
      default:
        return <FileText className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white shadow-sm dark:bg-gray-800 border-b dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">TaskTracker Pro</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Client Dashboard</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <a
                href="https://github.com/yourusername/tasktracker-pro"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                About
              </a>
              {monthlyTasks.length > 0 && (
                <>
                  <button
                    onClick={exportPDF}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export PDF
                  </button>
                  <button
                    onClick={() => {
                      const getClientById = () => client;
                      exportMonthlyReportToCSV(monthlyTasks, getClientById, getProject, client.name, format(reportDate, 'MMMM-yyyy'));
                    }}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-md border border-gray-200 dark:border-gray-700 p-6 dark:bg-gray-800">
          {/* Client Info & Month Navigation */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8 space-y-4 lg:space-y-0">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Calendar className="w-5 h-5 text-blue-500" />
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {client.name}
                </h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Service Rate: ${client.hourlyRate}/hour • {format(reportDate, 'MMMM yyyy')}
              </p>
            </div>
            
            {/* Month Navigation */}
            <div className="flex items-center space-x-4">
              <button
                onClick={previousMonth}
                className="p-2 hover:bg-gray-100 rounded-full dark:hover:bg-gray-700 transition-colors"
                title="Previous month"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
              <div className="text-center min-w-[120px]">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {format(reportDate, 'MMM yyyy')}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {monthlyTasks.length} tasks
                </p>
              </div>
              <button
                onClick={nextMonth}
                className="p-2 hover:bg-gray-100 rounded-full dark:hover:bg-gray-700 transition-colors"
                title="Next month"
              >
                <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
              {!isWithinInterval(new Date(), { start: monthStart, end: monthEnd }) && (
                <button
                  onClick={goToCurrentMonth}
                  className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                >
                  Current
                </button>
              )}
            </div>
          </div>

          {isReportAvailable ? (
            <>
              {/* Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-blue-50 p-6 rounded-lg dark:bg-blue-900/20">
                  <div className="flex items-center">
                    <Clock className="w-8 h-8 text-blue-500 mr-3" />
                    <div>
                      <p className="text-sm text-blue-600 font-medium dark:text-blue-400">Service Hours</p>
                      <p className="text-2xl font-semibold text-blue-900 dark:text-blue-300">{clientStats.totalHours.toFixed(1)}</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        {monthlyTasks.filter(t => t.type !== 'insumos').length} service tasks
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-green-50 p-6 rounded-lg dark:bg-green-900/20">
                  <div className="flex items-center">
                    <DollarSign className="w-8 h-8 text-green-500 mr-3" />
                    <div>
                      <p className="text-sm text-green-600 font-medium dark:text-green-400">Service Total</p>
                      <p className="text-2xl font-semibold text-green-900 dark:text-green-300">${clientStats.serviceRevenue.toFixed(0)}</p>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        ${(clientStats.serviceRevenue / (clientStats.totalHours || 1)).toFixed(0)}/hour rate
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-purple-50 p-6 rounded-lg dark:bg-purple-900/20">
                  <div className="flex items-center">
                    <Package className="w-8 h-8 text-purple-500 mr-3" />
                    <div>
                      <p className="text-sm text-purple-600 font-medium dark:text-purple-400">Supplies Cost</p>
                      <p className="text-2xl font-semibold text-purple-900 dark:text-purple-300">${clientStats.suppliesCost.toFixed(0)}</p>
                      <p className="text-xs text-purple-600 dark:text-purple-400">
                        {clientStats.suppliesCount} supply items
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Incident vs Request Breakdown */}
              {(clientStats.incidentCount > 0 || clientStats.requestCount > 0) && (
                <div className="bg-gray-50 rounded-lg p-4 sm:p-6 mb-8 dark:bg-gray-700">
                  <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Service Type Breakdown</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {/* Incidents */}
                    <div className="bg-red-50 p-4 rounded-lg dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center">
                          <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
                          <div>
                            <p className="text-sm font-semibold text-red-700 dark:text-red-400">Incidents</p>
                            <p className="text-xs text-red-600 dark:text-red-500">Issues & Problems</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-semibold text-red-900 dark:text-red-300">{clientStats.incidentCount}</p>
                          <p className="text-xs text-red-600 dark:text-red-400">tasks</p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-red-700 dark:text-red-400">Hours:</span>
                          <span className="font-semibold text-red-900 dark:text-red-300">{clientStats.incidentHours.toFixed(1)}h</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-red-700 dark:text-red-400">Cost:</span>
                          <span className="font-semibold text-red-900 dark:text-red-300">
                            ${(clientStats.incidentHours * client.hourlyRate).toFixed(0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm pt-2 border-t border-red-200 dark:border-red-700">
                          <span className="text-red-700 dark:text-red-400">% of Services:</span>
                          <span className="font-semibold text-red-900 dark:text-red-300">
                            {clientStats.totalHours > 0 ? ((clientStats.incidentHours / clientStats.totalHours) * 100).toFixed(0) : 0}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Requests */}
                    <div className="bg-blue-50 p-4 rounded-lg dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center">
                          <FileText className="w-5 h-5 text-blue-500 mr-2" />
                          <div>
                            <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">Requests</p>
                            <p className="text-xs text-blue-600 dark:text-blue-500">Planned Work</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-semibold text-blue-900 dark:text-blue-300">{clientStats.requestCount}</p>
                          <p className="text-xs text-blue-600 dark:text-blue-400">tasks</p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-blue-700 dark:text-blue-400">Hours:</span>
                          <span className="font-semibold text-blue-900 dark:text-blue-300">{clientStats.requestHours.toFixed(1)}h</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-blue-700 dark:text-blue-400">Cost:</span>
                          <span className="font-semibold text-blue-900 dark:text-blue-300">
                            ${(clientStats.requestHours * client.hourlyRate).toFixed(0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm pt-2 border-t border-blue-200 dark:border-blue-700">
                          <span className="text-blue-700 dark:text-blue-400">% of Services:</span>
                          <span className="font-semibold text-blue-900 dark:text-blue-300">
                            {clientStats.totalHours > 0 ? ((clientStats.requestHours / clientStats.totalHours) * 100).toFixed(0) : 0}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 6-Month Performance Trend */}
              {trendData.some(d => d.hours > 0) && (
                <div className="bg-gray-50 rounded-lg p-6 mb-8 dark:bg-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                      <BarChart3 className="w-5 h-5 text-blue-500 mr-2" />
                      6-Month Performance Trend
                    </h4>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-blue-500 rounded"></div>
                        <span className="text-gray-600 dark:text-gray-400">Requests</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-red-500 rounded"></div>
                        <span className="text-gray-600 dark:text-gray-400">Incidents</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-6 gap-2">
                    {trendData.map((data, index) => {
                      const maxHours = Math.max(...trendData.map(d => d.hours));
                      const isCurrentMonth = data.year === parseInt(year) && data.monthNum === parseInt(month);

                      const incidentHeight = maxHours > 0 ? Math.max((data.incidentHours / maxHours) * 100, data.incidentHours > 0 ? 5 : 0) : 0;
                      const requestHeight = maxHours > 0 ? Math.max((data.requestHours / maxHours) * 100, data.requestHours > 0 ? 5 : 0) : 0;

                      return (
                        <div
                          key={`${data.year}-${data.monthNum}`}
                          className="text-center cursor-pointer group transition-all duration-200 hover:scale-105"
                          onClick={() => window.location.href = `/report/${clientSlug}/${data.year}/${data.monthNum}`}
                          title={`Click to view ${data.month} ${data.year} report\nIncidents: ${data.incidentHours.toFixed(1)}h\nRequests: ${data.requestHours.toFixed(1)}h`}
                        >
                          <div className="h-24 flex items-end justify-center mb-2">
                            <div className="w-8 flex flex-col items-stretch">
                              {data.incidentHours > 0 && (
                                <div
                                  className={`w-full transition-all duration-300 ${
                                    isCurrentMonth
                                      ? 'bg-red-500 group-hover:bg-red-600'
                                      : 'bg-red-400 dark:bg-red-500 group-hover:bg-red-500 dark:group-hover:bg-red-600'
                                  } ${data.requestHours > 0 ? '' : 'rounded-t'}`}
                                  style={{ height: `${incidentHeight}%` }}
                                />
                              )}
                              {data.requestHours > 0 && (
                                <div
                                  className={`w-full rounded-t transition-all duration-300 ${
                                    isCurrentMonth
                                      ? 'bg-blue-500 group-hover:bg-blue-600'
                                      : 'bg-blue-400 dark:bg-blue-500 group-hover:bg-blue-500 dark:group-hover:bg-blue-600'
                                  }`}
                                  style={{ height: `${requestHeight}%` }}
                                />
                              )}
                              {data.hours === 0 && (
                                <div
                                  className="w-full rounded-t bg-gray-200 dark:bg-gray-600 group-hover:bg-gray-300 dark:group-hover:bg-gray-500"
                                  style={{ height: '5%' }}
                                />
                              )}
                            </div>
                          </div>
                          <p className={`text-xs font-medium ${
                            isCurrentMonth
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                          }`}>
                            {data.month}
                          </p>
                          <p className={`text-xs font-medium transition-colors ${
                            isCurrentMonth
                              ? 'text-blue-900 dark:text-blue-300'
                              : 'text-gray-900 dark:text-white group-hover:text-blue-900 dark:group-hover:text-blue-300'
                          }`}>
                            {data.hours.toFixed(1)}h
                          </p>
                          <p className={`text-xs transition-colors ${
                            isCurrentMonth
                              ? 'text-green-700 dark:text-green-300'
                              : 'text-green-600 dark:text-green-400 group-hover:text-green-700 dark:group-hover:text-green-300'
                          }`}>
                            ${data.revenue.toFixed(0)}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex justify-between items-center text-sm text-gray-600 dark:text-gray-400">
                    <span>6-month average: {(trendData.reduce((sum, d) => sum + d.hours, 0) / 6).toFixed(1)}h/month</span>
                    <span>Total billed: ${trendData.reduce((sum, d) => sum + d.revenue, 0).toFixed(0)}</span>
                  </div>
                  <div className="mt-2 text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      💡 <strong>Tip:</strong> Click on any month bar to view that month's detailed report
                    </p>
                  </div>
                </div>
              )}

              {/* Tasks List */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                  Completed Tasks ({monthlyTasks.length})
                </h3>
                
                <div className="space-y-4">
                  {monthlyTasks
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map(task => {
                      const project = getProject(task.projectId);
                      
                      return (
                        <div key={task.id} className="border rounded-lg p-4 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700 transition-colors">
                          <div className="flex justify-between items-start">
                            <div className="flex items-start space-x-3 flex-1">
                              {getTaskIcon(task.type)}
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">{project?.name}</p>
                                  <span className="text-sm text-gray-500 dark:text-gray-400">•</span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {format(new Date(task.date), 'MMM d, yyyy')}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-300">{task.description}</p>
                                <div className="flex items-center space-x-2 mt-2">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    task.type === 'incident' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                    task.type === 'insumos' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                                    'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                  }`}>
                                    {task.type === 'incident' ? 'Incident' : task.type === 'insumos' ? 'Supplies' : 'Request'}
                                  </span>
                                  {task.priority && (
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                      task.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                      task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    }`}>
                                      {task.priority} priority
                                    </span>
                                  )}
                                </div>
                                {task.notes && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                                    Note: {task.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              {task.type === 'insumos' ? (
                                <div>
                                  <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                                    ${task.cost?.toFixed(2)}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">Supply cost</p>
                                </div>
                              ) : (
                                <div>
                                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                                    {task.hours?.toFixed(1)}h
                                  </p>
                                  <p className="text-sm text-green-600 dark:text-green-400">
                                    ${((task.hours || 0) * client.hourlyRate).toFixed(2)}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-lg mx-auto mb-6 dark:bg-gray-700">
                <Calendar className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                No Completed Tasks This Month
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                No completed tasks found for <strong>{format(reportDate, 'MMMM yyyy')}</strong>. 
                Your service provider will update this report as tasks are completed.
              </p>
              
              {/* Month Navigation */}
              <div className="flex justify-center space-x-4">
                <button
                  onClick={previousMonth}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous Month
                </button>
                <button
                  onClick={goToCurrentMonth}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  <Calendar className="w-4 h-4 mr-1" />
                  Current Month
                </button>
                <button
                  onClick={nextMonth}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Next Month
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
              
              {/* Show if there are any completed tasks in other months */}
              {clientTasks.filter(t => t.finished).length > 0 && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg dark:bg-blue-900/20">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    📊 You have completed tasks in other months. Use the navigation above to view them.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}