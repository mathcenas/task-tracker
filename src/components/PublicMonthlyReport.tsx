import React from 'react';
import { useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { format, startOfMonth, endOfMonth, isWithinInterval, isAfter, endOfDay, subMonths, addMonths } from 'date-fns';
import { Clock, AlertTriangle, FileText, Package, DollarSign, Calendar, Download, ChevronLeft, ChevronRight, BarChart3, TrendingUp } from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export function PublicMonthlyReport() {
  const { clientSlug, year, month } = useParams<{ clientSlug: string; year: string; month: string }>();
  const { getClientBySlug, getClientTasks, getProject, clients } = useApp();

  // Handle missing parameters
  if (!clientSlug || !year || !month) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-lg mx-auto mb-6 dark:bg-red-900/20">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Invalid Report URL</h1>
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

  const client = getClientBySlug(clientSlug);
  
  // If client not found, show available clients
  if (!client) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-lg p-8 dark:bg-gray-800">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center w-16 h-16 bg-blue-600 rounded-lg mx-auto mb-6">
                <Clock className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">TaskTracker Pro</h1>
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
                  href="/about"
                  className="inline-flex items-center px-6 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
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

  const reportDate = new Date(parseInt(year), parseInt(month) - 1, 1);
  const monthStart = startOfMonth(reportDate);
  const monthEnd = endOfMonth(reportDate);
  const today = new Date();
  
  // Get client tasks for the requested month
  const clientTasks = getClientTasks(client.id);
  const monthlyTasks = clientTasks.filter(task => 
    task.finished && 
    isWithinInterval(new Date(task.date), { start: monthStart, end: monthEnd })
  );
  
  // Report is available if there are completed tasks for that month
  const isReportAvailable = monthlyTasks.length > 0;

  // Calculate 6-month trend data
  const trendData = Array.from({ length: 6 }, (_, i) => {
    const month = subMonths(reportDate, 5 - i);
    const monthTasks = clientTasks.filter(task => 
      task.finished && 
      isWithinInterval(new Date(task.date), { start: startOfMonth(month), end: endOfMonth(month) })
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

  const clientStats = monthlyTasks.reduce((stats, task) => {
    if (task.type === 'insumos') {
      stats.suppliesCost += task.cost || 0;
    } else {
      stats.totalHours += task.hours || 0;
      stats.serviceRevenue += (task.hours || 0) * client.hourlyRate;
    }
    return stats;
  }, { totalHours: 0, serviceRevenue: 0, suppliesCost: 0 });

  const exportPDF = () => {
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
    const reportNumber = `RPT-${year}${month.padStart(2, '0')}-${client.id.slice(-6)}`;
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

    const servicesTotal = servicesTasks.reduce((sum, task) => 
      sum + ((task.hours || 0) * hourlyRate), 0);
    const suppliesTotal = suppliesTasks.reduce((sum, task) => 
      sum + (task.cost || 0), 0);
    const totalAmount = servicesTotal + suppliesTotal;

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
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">TaskTracker Pro</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Client Dashboard</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <a
                href="/about"
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                About
              </a>
              {monthlyTasks.length > 0 && (
                <button
                  onClick={exportPDF}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export PDF
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6 dark:bg-gray-800">
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
                      <p className="text-3xl font-bold text-blue-900 dark:text-blue-300">{clientStats.totalHours.toFixed(1)}</p>
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
                      <p className="text-sm text-green-600 font-medium dark:text-green-400">Service Revenue</p>
                      <p className="text-3xl font-bold text-green-900 dark:text-green-300">${clientStats.serviceRevenue.toFixed(0)}</p>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        ${(clientStats.serviceRevenue / (clientStats.totalHours || 1)).toFixed(0)}/hour avg
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-purple-50 p-6 rounded-lg dark:bg-purple-900/20">
                  <div className="flex items-center">
                    <Package className="w-8 h-8 text-purple-500 mr-3" />
                    <div>
                      <p className="text-sm text-purple-600 font-medium dark:text-purple-400">Supplies Cost</p>
                      <p className="text-3xl font-bold text-purple-900 dark:text-purple-300">${clientStats.suppliesCost.toFixed(0)}</p>
                      <p className="text-xs text-purple-600 dark:text-purple-400">
                        {monthlyTasks.filter(t => t.type === 'insumos').length} supply items
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 6-Month Trend Chart */}
              {trendData.some(d => d.hours > 0) && (
                <div className="bg-gray-50 rounded-lg p-6 mb-8 dark:bg-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                      <BarChart3 className="w-5 h-5 text-blue-500 mr-2" />
                      6-Month Performance Trend
                    </h4>
                  </div>
                  
                  <div className="grid grid-cols-6 gap-2">
                    {trendData.map((data, index) => {
                      const maxHours = Math.max(...trendData.map(d => d.hours));
                      const height = maxHours > 0 ? Math.max((data.hours / maxHours) * 100, 5) : 5;
                      const isCurrentMonth = format(reportDate, 'MMM') === data.month;
                      
                      return (
                        <div key={data.month} className="text-center">
                          <div className="h-24 flex items-end justify-center mb-2">
                            <div 
                              className={`w-8 rounded-t transition-all duration-300 ${
                                isCurrentMonth 
                                  ? 'bg-blue-500' 
                                  : data.hours > 0
                                  ? 'bg-gray-400 dark:bg-gray-500'
                                  : 'bg-gray-200 dark:bg-gray-600'
                              }`}
                              style={{ height: `${height}%` }}
                              title={`${data.hours.toFixed(1)} hours, $${data.revenue.toFixed(0)}`}
                            />
                          </div>
                          <p className={`text-xs font-medium ${
                            isCurrentMonth 
                              ? 'text-blue-600 dark:text-blue-400' 
                              : 'text-gray-600 dark:text-gray-400'
                          }`}>
                            {data.month}
                          </p>
                          <p className="text-xs text-gray-900 dark:text-white">{data.hours.toFixed(1)}h</p>
                          <p className="text-xs text-green-600 dark:text-green-400">${data.revenue.toFixed(0)}</p>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="mt-4 flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>6-month average: {(trendData.reduce((sum, d) => sum + d.hours, 0) / 6).toFixed(1)}h/month</span>
                    <span>Total revenue: ${trendData.reduce((sum, d) => sum + d.revenue, 0).toFixed(0)}</span>
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
            <div className="text-center py-16">
              <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-lg mx-auto mb-6 dark:bg-gray-700">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                No Tasks Completed
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                No completed tasks found for {format(reportDate, 'MMMM yyyy')}. 
                Tasks will appear here once they are completed by your service provider.
              </p>
              
              {/* Show navigation to months with data */}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}