import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { format, isToday, isTomorrow, isYesterday, startOfMonth, endOfMonth, isWithinInterval, subMonths, addMonths, parseISO } from 'date-fns';
import { Download, Plus, AlertTriangle, FileText, Pencil, Package, DollarSign, Clock, Calendar, ChevronLeft, ChevronRight, BarChart3, TrendingUp, Trash2, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export function ClientDashboard() {
  const { clients, getClientTasks, getProject, deleteClient } = useApp();
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [selectedMonth, setSelectedMonth] = useState(new Date());
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

  const getRelativeDate = (date: string) => {
    const taskDate = new Date(date);
    if (isToday(taskDate)) return 'Today';
    if (isTomorrow(taskDate)) return 'Tomorrow';
    if (isYesterday(taskDate)) return 'Yesterday';
    return format(taskDate, 'MMM d, yyyy');
  };

  const exportMonthlyReport = (clientData: any, clientTasks: any[], exportMonth = selectedMonth) => {
    const exportMonthStart = startOfMonth(exportMonth);
    const exportMonthEnd = endOfMonth(exportMonth);
    const exportTasks = clientTasks.filter(task =>
      task.finished &&
      isWithinInterval(new Date(task.date), { start: exportMonthStart, end: exportMonthEnd })
    );

    const doc = new jsPDF();
    const clientName = clientData.name;
    const monthYear = format(exportMonth, 'MMMM yyyy');
    const hourlyRate = clientData.hourlyRate;

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
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    doc.setFontSize(12);
    doc.text(`Report #: ${invoiceNumber}`, 35, 50);

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

    const servicesTasks = exportTasks.filter(task => task.type !== 'insumos');
    const suppliesTasks = exportTasks.filter(task => task.type === 'insumos');

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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Clients</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-2">{totalClients}</p>
            </div>
            <Users className="w-12 h-12 text-blue-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active This Month</p>
              <p className="text-2xl font-semibold text-blue-600 dark:text-blue-400 mt-2">{activeClients}</p>
            </div>
            <TrendingUp className="w-12 h-12 text-blue-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Monthly Revenue</p>
              <p className="text-2xl font-semibold text-green-600 dark:text-green-400 mt-2">${totalMonthlyRevenue.toFixed(0)}</p>
            </div>
            <DollarSign className="w-12 h-12 text-green-500 opacity-20" />
          </div>
        </div>
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
    </div>
  );
}
