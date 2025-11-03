import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { format, isToday, isTomorrow, isYesterday, startOfMonth, endOfMonth, isWithinInterval, subMonths, addMonths, parseISO } from 'date-fns';
import { Download, Plus, AlertTriangle, FileText, Pencil, Package, DollarSign, Clock, Calendar, ChevronLeft, ChevronRight, BarChart3, TrendingUp, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export function ClientDashboard() {
  const { clients, getClientTasks, getProject, deleteClient } = useApp();
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();

  const handleDeleteClient = async () => {
    if (!selectedClient || !selectedClientData) return;

    const tasksCount = selectedClientTasks.length;
    const confirmMessage = tasksCount > 0
      ? `Are you sure you want to delete "${selectedClientData.name}"?\n\nThis will also delete ${tasksCount} associated task${tasksCount === 1 ? '' : 's'}.\n\nThis action cannot be undone.`
      : `Are you sure you want to delete "${selectedClientData.name}"?\n\nThis action cannot be undone.`;

    if (window.confirm(confirmMessage)) {
      try {
        await deleteClient(selectedClient);
        setSelectedClient('');
        alert(`✅ Client "${selectedClientData.name}" has been deleted successfully.`);
      } catch (error) {
        console.error('Error deleting client:', error);
        alert('❌ Failed to delete client. Please try again.');
      }
    }
  };

  const selectedClientTasks = selectedClient ? getClientTasks(selectedClient) : [];
  const selectedClientData = clients.find(c => c.id === selectedClient);

  // Force refresh when tasks change
  React.useEffect(() => {
    setRefreshKey(prev => prev + 1);
  }, [selectedClientTasks.length, selectedClient]);

  // Filter tasks for selected month
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  
  console.log('📅 Filtering tasks for month:', {
    selectedMonth: format(selectedMonth, 'yyyy-MM'),
    monthStart: format(monthStart, 'yyyy-MM-dd'),
    monthEnd: format(monthEnd, 'yyyy-MM-dd'),
    totalClientTasks: selectedClientTasks.length
  });
  
  const monthlyTasks = selectedClientTasks.filter(task => 
    task.finished && 
    isWithinInterval(parseISO(task.date), { start: monthStart, end: monthEnd })
  );
  
  console.log('📊 Monthly tasks found:', monthlyTasks.length, monthlyTasks.map(t => ({ 
    description: t.description, 
    date: t.date, 
    finished: t.finished 
  })));
  
  // Calculate 6-month trend data
  const trendData = Array.from({ length: 6 }, (_, i) => {
    const month = subMonths(selectedMonth, 5 - i);
    const monthTasks = selectedClientTasks.filter(task => 
      task.finished && 
      isWithinInterval(parseISO(task.date), { start: startOfMonth(month), end: endOfMonth(month) })
    );
    const hours = monthTasks.filter(t => t.type !== 'insumos').reduce((sum, task) => sum + (task.hours || 0), 0);
    const revenue = hours * (selectedClientData?.hourlyRate || 0);
    
    return {
      month: format(month, 'MMM'),
      hours,
      revenue,
      tasks: monthTasks.length
    };
  });

  const getRelativeDate = (date: string) => {
    const taskDate = new Date(date);
    if (isToday(taskDate)) return 'Today';
    if (isTomorrow(taskDate)) return 'Tomorrow';
    if (isYesterday(taskDate)) return 'Yesterday';
    return format(taskDate, 'MMM d, yyyy');
  };

  const clientStats = monthlyTasks.reduce((stats, task) => {
    if (task.type === 'insumos') {
      stats.suppliesCost += task.cost || 0;
      stats.suppliesCount += 1;
    } else {
      stats.totalHours += task.hours || 0;
      stats.serviceRevenue += (task.hours || 0) * (selectedClientData?.hourlyRate || 0);

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

  const exportMonthlyReport = (exportMonth = selectedMonth) => {
    if (!selectedClientData) return;

    // Get tasks for the specific export month
    const exportMonthStart = startOfMonth(exportMonth);
    const exportMonthEnd = endOfMonth(exportMonth);
    const exportTasks = selectedClientTasks.filter(task => 
      task.finished && 
      isWithinInterval(new Date(task.date), { start: exportMonthStart, end: exportMonthEnd })
    );

    const doc = new jsPDF();
    const clientName = selectedClientData.name;
    const monthYear = format(exportMonth, 'MMMM yyyy');
    const hourlyRate = selectedClientData.hourlyRate;

    // Add company logo/header
    // Create a simple logo using shapes
    doc.setFillColor(41, 98, 255); // Blue color
    doc.roundedRect(15, 10, 12, 12, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text('⏰', 19, 18);
    
    // Company name
    doc.setFontSize(24);
    doc.setTextColor(41, 98, 255);
    doc.text('TaskTracker Pro', 35, 20);
    
    // Add invoice title and number
    doc.setFontSize(20);
    doc.setTextColor(0, 0, 0);
    doc.text('MONTHLY REPORT', 35, 40);
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    doc.setFontSize(12);
    doc.text(`Report #: ${invoiceNumber}`, 35, 50);
    
    // Add client and invoice details
    doc.setFontSize(12);
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

    // Group tasks by type
    const servicesTasks = exportTasks.filter(task => task.type !== 'insumos');
    const suppliesTasks = exportTasks.filter(task => task.type === 'insumos');

    // Add services table
    if (servicesTasks.length > 0) {
      doc.setFontSize(14);
      doc.text('Services', 20, yPos + 10);

      const servicesTableData = servicesTasks.map(task => [
        format(new Date(task.date), 'MMM d, yyyy'),
        getProject(task.projectId)?.name || '',
        task.type.charAt(0).toUpperCase() + task.type.slice(1),
        task.description,
        task.hours?.toString() || '',
        `$${(task.hours * hourlyRate).toFixed(2)}`
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

    // Add supplies table
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

    // Add summary
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

    // Add footer
    const footerText = 'Thank you for your business!';
    doc.setFontSize(10);
    doc.setTextColor(128, 128, 128);
    doc.text(footerText, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });

    // Save the PDF
    doc.save(`${clientName.toLowerCase().replace(/\s+/g, '-')}-monthly-report-${format(exportMonth, 'yyyy-MM')}.pdf`);
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

      <div className="bg-white rounded-md border border-gray-200 dark:border-gray-700 p-6 dark:bg-gray-800">
        <div className="mb-6">
          <label htmlFor="clientSelect" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Client
          </label>
          <div className="flex gap-3">
            <select
              id="clientSelect"
              className="flex-1 p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:border-blue-500 focus:ring-blue-500 transition-all duration-200"
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
            >
              <option value="">Choose a client to view their tasks...</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
            {selectedClient && (
              <button
                onClick={handleDeleteClient}
                className="px-4 py-2 border border-red-300 rounded-lg shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 dark:border-red-700 dark:bg-gray-700 dark:text-red-400 dark:hover:bg-red-900/20 transition-all duration-200 flex items-center gap-2"
                title="Delete client"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
        </div>

        {selectedClient && (
          <div className="space-y-4">
            {/* Month Navigation */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg dark:bg-gray-700">
              <div className="flex items-center space-x-4">
                <button
                  onClick={previousMonth}
                  className="p-2 hover:bg-gray-200 rounded-full dark:hover:bg-gray-600 transition-colors"
                  title="Previous month"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </button>
                <div className="text-center">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {format(selectedMonth, 'MMMM yyyy')}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {monthlyTasks.length} completed tasks
                  </p>
                </div>
                <button
                  onClick={nextMonth}
                  className="p-2 hover:bg-gray-200 rounded-full dark:hover:bg-gray-600 transition-colors"
                  title="Next month"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </button>
              </div>
              <div className="flex items-center space-x-2">
                {!isWithinInterval(new Date(), { start: monthStart, end: monthEnd }) && (
                  <button
                    onClick={goToCurrentMonth}
                    className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  >
                    Current Month
                  </button>
                )}
                <button
                  onClick={() => exportMonthlyReport(selectedMonth)}
                  disabled={monthlyTasks.length === 0}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed dark:bg-green-500 dark:hover:bg-green-600 transition-all duration-200"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Export
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {selectedClientData?.name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Service Rate: ${selectedClientData?.hourlyRate}/hour
                </p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    const year = selectedMonth.getFullYear();
                    const month = selectedMonth.getMonth() + 1;
                    
                    // Debug: Log client data
                    console.log('Selected client data:', selectedClientData);
                    console.log('All clients:', clients.map(c => ({ name: c.name, slug: c.slug })));
                    
                    if (!selectedClientData) {
                      alert(`❌ Error: Client not found. Please select a client first.`);
                      return;
                    }
                    
                    if (!selectedClientData.slug) {
                      alert(`❌ Error: Client slug not found for "${selectedClientData.name}".\n\nThis usually happens with older clients. Please:\n1. Refresh the page\n2. Try again\n\nIf the problem persists, the client may need to be re-added.`);
                      return;
                    }
                    
                    const url = `${window.location.origin}/report/${selectedClientData.slug}/${year}/${month}`;
                    navigator.clipboard.writeText(url);
                    alert(`✅ Client report URL copied!\n\n${url}\n\nShare this URL with your client to view their monthly report.\n\n📋 Details:\n• Client: ${selectedClientData.name}\n• Slug: ${selectedClientData.slug}\n• Month: ${format(selectedMonth, 'MMMM yyyy')}\n\n🔒 Note: This URL shows ONLY client information - no admin features visible.`);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-blue-300 rounded-lg shadow-sm text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-all duration-200"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Copy Client URL
                </button>
              </div>
            </div>

            {/* Monthly Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg dark:bg-blue-900/20">
                <div className="flex items-center">
                  <Clock className="w-8 h-8 text-blue-500 mr-3" />
                  <div>
                    <p className="text-sm text-blue-600 font-medium dark:text-blue-400">This Month</p>
                    <p className="text-xl font-semibold text-blue-900 dark:text-blue-300">{clientStats.totalHours.toFixed(1)}h</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      {monthlyTasks.filter(t => t.type !== 'insumos').length} service tasks
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg dark:bg-green-900/20">
                <div className="flex items-center">
                  <DollarSign className="w-8 h-8 text-green-500 mr-3" />
                  <div>
                    <p className="text-sm text-green-600 font-medium dark:text-green-400">Service Revenue</p>
                    <p className="text-xl font-semibold text-green-900 dark:text-green-300">${clientStats.serviceRevenue.toFixed(0)}</p>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      ${(clientStats.serviceRevenue / (clientStats.totalHours || 1)).toFixed(0)}/hour
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg dark:bg-purple-900/20">
                <div className="flex items-center">
                  <Package className="w-8 h-8 text-purple-500 mr-3" />
                  <div>
                    <p className="text-sm text-purple-600 font-medium dark:text-purple-400">Supplies Cost</p>
                    <p className="text-xl font-semibold text-purple-900 dark:text-purple-300">${clientStats.suppliesCost.toFixed(0)}</p>
                    <p className="text-xs text-purple-600 dark:text-purple-400">
                      {clientStats.suppliesCount} supply items
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Incident vs Request Breakdown */}
            {(clientStats.incidentCount > 0 || clientStats.requestCount > 0) && (
              <div className="bg-white rounded-md border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-6 dark:bg-gray-800">
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
                          ${(clientStats.incidentHours * (selectedClientData?.hourlyRate || 0)).toFixed(0)}
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
                          ${(clientStats.requestHours * (selectedClientData?.hourlyRate || 0)).toFixed(0)}
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
            
            {/* 6-Month Trend Chart */}
            {selectedClientData && trendData.some(d => d.hours > 0) && (
              <div className="bg-white rounded-md border border-gray-200 dark:border-gray-700 p-6 mb-6 dark:bg-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                    <BarChart3 className="w-5 h-5 text-blue-500 mr-2" />
                    6-Month Trend
                  </h4>
                </div>
                
                <div className="grid grid-cols-6 gap-2">
                  {trendData.map((data, index) => {
                    const maxHours = Math.max(...trendData.map(d => d.hours));
                    const height = maxHours > 0 ? (data.hours / maxHours) * 100 : 0;
                    const isCurrentMonth = index === 5;
                    const monthDate = subMonths(selectedMonth, 5 - index);
                    
                    return (
                      <div 
                        key={data.month} 
                        className="text-center cursor-pointer group transition-all duration-200 hover:scale-105"
                        onClick={() => setSelectedMonth(monthDate)}
                        title={`Click to view ${format(monthDate, 'MMMM yyyy')} report`}
                      >
                        <div className="h-24 flex items-end justify-center mb-2">
                          <div 
                            className={`w-8 rounded-t transition-all duration-300 ${
                              isCurrentMonth 
                                ? 'bg-blue-500 group-hover:bg-blue-600' 
                                : data.hours > 0
                                ? 'bg-gray-400 dark:bg-gray-500 group-hover:bg-blue-400 dark:group-hover:bg-blue-500'
                                : 'bg-gray-200 dark:bg-gray-600 group-hover:bg-gray-300 dark:group-hover:bg-gray-500'
                            }`}
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <p className={`text-xs transition-colors ${
                          isCurrentMonth 
                            ? 'text-blue-600 dark:text-blue-400 font-medium' 
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
                  <span>Total revenue: ${trendData.reduce((sum, d) => sum + d.revenue, 0).toFixed(0)}</span>
                </div>
                <div className="mt-2 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    💡 <strong>Tip:</strong> Click on any month bar to view that month's detailed report
                  </p>
                </div>
              </div>
            )}

            {/* Monthly Tasks List */}
            <div className="space-y-4">
              {monthlyTasks.length > 0 ? (
                <div className="space-y-3">
                  {monthlyTasks
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map(task => {
                      const project = getProject(task.projectId);
                      
                      return (
                        <div key={task.id} className="border rounded-lg p-4 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700 transition-all duration-200 group">
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
                                <div className="flex items-center space-x-2 mt-2">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    task.type === 'incident' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                    task.type === 'insumos' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                                    'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                  }`}>
                                    {task.type}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3">
                              <div className="text-right">
                                {task.type === 'insumos' ? (
                                  <div>
                                    <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                                      ${task.cost?.toFixed(2)}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Supply cost</p>
                                  </div>
                                ) : (
                                  <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                      {task.hours?.toFixed(1)}h
                                    </p>
                                    <p className="text-sm text-green-600 dark:text-green-400">
                                      ${((task.hours || 0) * (selectedClientData?.hourlyRate || 0)).toFixed(2)}
                                    </p>
                                  </div>
                                )}
                              </div>
                              <Link
                                to={`/edit-task/${task.id}`}
                                className="p-2 hover:bg-gray-100 rounded-lg dark:hover:bg-gray-600 transition-colors opacity-0 group-hover:opacity-100"
                                title="Edit task"
                              >
                                <Pencil className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">No completed tasks this month</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                    Tasks will appear here once they are completed
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}