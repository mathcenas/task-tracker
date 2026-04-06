import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { startOfMonth, endOfMonth, format, isWithinInterval, isToday, isTomorrow, isYesterday, parseISO, subMonths } from 'date-fns';
import { AlertTriangle, FileText, ChevronLeft, ChevronRight, Package, TrendingUp, Clock, DollarSign, CheckCircle, Plus, Download, Calendar, CreditCard as Edit, FileDown } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { exportTasksToCSV } from '../utils/csvExport';
import { exportMultiMonthPDF } from '../utils/multiMonthPdfExport';

export function MonthlyDashboard() {
  const { tasks, getClient, getProject, companySettings } = useApp();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [refreshKey, setRefreshKey] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPdfExport, setShowPdfExport] = useState(false);
  const [pdfMonthCount, setPdfMonthCount] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  // Force refresh when tasks change
  React.useEffect(() => {
    setRefreshKey(prev => prev + 1);
  }, [tasks.length, currentDate]);

  // Filter only completed tasks
  const monthlyTasks = tasks.filter(task => 
    task.finished && 
    isWithinInterval(parseISO(task.date), { start: monthStart, end: monthEnd })
  );
  
  console.log('📅 Monthly Dashboard - filtering for:', {
    month: format(currentDate, 'yyyy-MM'),
    monthStart: format(monthStart, 'yyyy-MM-dd'),
    monthEnd: format(monthEnd, 'yyyy-MM-dd'),
    totalTasks: tasks.length,
    completedTasks: tasks.filter(t => t.finished).length,
    monthlyTasks: monthlyTasks.length
  });

  const totalHours = monthlyTasks
    .filter(task => task.type !== 'insumos')
    .reduce((sum, task) => sum + (task.hours || 0), 0);

  const serviceRevenue = monthlyTasks
    .filter(task => task.type !== 'insumos')
    .reduce((sum, task) => {
      const client = getClient(task.clientId);
      return sum + ((task.hours || 0) * (client?.hourlyRate || 0));
    }, 0);

  const suppliesCost = monthlyTasks
    .filter(task => task.type === 'insumos')
    .reduce((sum, task) => sum + (task.cost || 0), 0);

  const totalRevenue = serviceRevenue - suppliesCost;

  // Analytics calculations
  const clientStats = monthlyTasks.reduce((acc, task) => {
    const clientId = task.clientId;
    const client = getClient(clientId);
    if (!client) return acc;

    if (!acc[clientId]) {
      acc[clientId] = {
        name: client.name,
        hours: 0,
        revenue: 0,
        taskCount: 0
      };
    }

    if (task.type !== 'insumos') {
      acc[clientId].hours += task.hours || 0;
      acc[clientId].revenue += (task.hours || 0) * client.hourlyRate;
    } else {
      acc[clientId].revenue -= task.cost || 0;
    }
    acc[clientId].taskCount += 1;

    return acc;
  }, {} as Record<string, { name: string; hours: number; revenue: number; taskCount: number }>);

  const sortedByHours = Object.entries(clientStats)
    .sort((a, b) => b[1].hours - a[1].hours)
    .slice(0, 3);

  const sortedByRevenue = Object.entries(clientStats)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 3);

  const sortedByTasks = Object.entries(clientStats)
    .sort((a, b) => b[1].taskCount - a[1].taskCount)
    .slice(0, 3);

  const incidentCount = monthlyTasks.filter(t => t.type === 'incident').length;
  const requestCount = monthlyTasks.filter(t => t.type === 'request').length;
  const suppliesCount = monthlyTasks.filter(t => t.type === 'insumos').length;

  const getRelativeDate = (date: string) => {
    const taskDate = new Date(date);
    if (isToday(taskDate)) return 'Today';
    if (isTomorrow(taskDate)) return 'Tomorrow';
    if (isYesterday(taskDate)) return 'Yesterday';
    return format(taskDate, 'MMM d');
  };

  const previousMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value + '-01');
    setCurrentDate(newDate);
    setShowDatePicker(false);
  };

  const handlePdfExport = async () => {
    setIsExporting(true);
    try {
      const monthsData = [];

      for (let i = pdfMonthCount - 1; i >= 0; i--) {
        const monthDate = subMonths(currentDate, i);
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);

        const monthTasks = tasks.filter(task =>
          task.finished &&
          isWithinInterval(parseISO(task.date), { start: monthStart, end: monthEnd })
        );

        const monthTotalHours = monthTasks
          .filter(task => task.type !== 'insumos')
          .reduce((sum, task) => sum + (task.hours || 0), 0);

        const monthServiceRevenue = monthTasks
          .filter(task => task.type !== 'insumos')
          .reduce((sum, task) => {
            const client = getClient(task.clientId);
            return sum + ((task.hours || 0) * (client?.hourlyRate || 0));
          }, 0);

        const monthSuppliesCost = monthTasks
          .filter(task => task.type === 'insumos')
          .reduce((sum, task) => sum + (task.cost || 0), 0);

        monthsData.push({
          month: format(monthDate, 'MMMM yyyy'),
          tasks: monthTasks,
          totalHours: monthTotalHours,
          serviceRevenue: monthServiceRevenue,
          suppliesCost: monthSuppliesCost,
          netRevenue: monthServiceRevenue - monthSuppliesCost,
          incidentCount: monthTasks.filter(t => t.type === 'incident').length,
          requestCount: monthTasks.filter(t => t.type === 'request').length,
          suppliesCount: monthTasks.filter(t => t.type === 'insumos').length
        });
      }

      const filename = pdfMonthCount === 1
        ? `monthly-report-${format(currentDate, 'yyyy-MM')}.pdf`
        : `multi-month-report-${format(subMonths(currentDate, pdfMonthCount - 1), 'yyyy-MM')}-to-${format(currentDate, 'yyyy-MM')}.pdf`;

      await exportMultiMonthPDF(monthsData, getClient, getProject, companySettings, filename);
      setShowPdfExport(false);
    } catch (error) {
      console.error('Failed to export PDF:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
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
    <div className="space-y-4">
      <div className="bg-white rounded-md border border-gray-200 dark:border-gray-700 p-6 dark:bg-gray-800">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Monthly Overview</h2>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Jump to Today */}
            <button
              onClick={goToToday}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-400 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 transition-all"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Today
            </button>

            {/* Date Picker */}
            <div className="relative">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 transition-colors"
              >
                Jump to Date
              </button>
              {showDatePicker && (
                <div className="absolute right-0 mt-2 z-10">
                  <input
                    type="month"
                    value={format(currentDate, 'yyyy-MM')}
                    onChange={handleDateChange}
                    className="px-3 py-2 border border-gray-300 rounded-lg shadow-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              )}
            </div>

            {/* Export Buttons */}
            <button
              onClick={() => exportTasksToCSV(monthlyTasks, getClient, getProject, `monthly-tasks-${format(currentDate, 'yyyy-MM')}.csv`)}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 transition-colors"
              title="Export to CSV"
            >
              <Download className="w-4 h-4 mr-2" />
              CSV
            </button>

            <button
              onClick={() => setShowPdfExport(true)}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 transition-colors"
              title="Export to PDF"
            >
              <FileDown className="w-4 h-4 mr-2" />
              PDF
            </button>

            {/* Month Navigation */}
            <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg">
              <button
                onClick={previousMonth}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-l-lg transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-5 h-5 dark:text-gray-400" />
              </button>
              <span className="px-4 text-sm font-medium dark:text-white border-x border-gray-300 dark:border-gray-600">
                {format(currentDate, 'MMM yyyy')}
              </span>
              <button
                onClick={nextMonth}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-r-lg transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-5 h-5 dark:text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg dark:bg-blue-900/20">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-blue-500 mr-3" />
              <div>
                <p className="text-sm text-blue-600 font-medium dark:text-blue-400">Service Hours</p>
                <p className="text-xl font-semibold text-blue-900 dark:text-blue-300">{totalHours.toFixed(1)}</p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg dark:bg-green-900/20">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-green-500 mr-3" />
              <div>
                <p className="text-sm text-green-600 font-medium dark:text-green-400">Revenue</p>
                <p className="text-xl font-semibold text-green-900 dark:text-green-300">${serviceRevenue.toFixed(0)}</p>
              </div>
            </div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg dark:bg-purple-900/20">
            <div className="flex items-center">
              <Package className="w-8 h-8 text-purple-500 mr-3" />
              <div>
                <p className="text-sm text-purple-600 font-medium dark:text-purple-400">Supplies</p>
                <p className="text-xl font-semibold text-purple-900 dark:text-purple-300">${suppliesCost.toFixed(0)}</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg dark:bg-gray-700">
            <div className="flex items-center">
              <CheckCircle className="w-8 h-8 text-gray-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600 font-medium dark:text-gray-400">Completed Tasks</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-gray-300">{monthlyTasks.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Client Analytics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Top by Hours */}
          <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
              <Clock className="w-4 h-4 mr-2" />
              Top Clients by Hours
            </h3>
            <div className="space-y-2">
              {sortedByHours.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No data</p>
              ) : (
                sortedByHours.map(([_, stats], idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <span className="text-gray-700 dark:text-gray-300 truncate mr-2">{stats.name}</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">{stats.hours.toFixed(1)}h</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Top by Revenue */}
          <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
              <DollarSign className="w-4 h-4 mr-2" />
              Top Clients by Revenue
            </h3>
            <div className="space-y-2">
              {sortedByRevenue.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No data</p>
              ) : (
                sortedByRevenue.map(([_, stats], idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <span className="text-gray-700 dark:text-gray-300 truncate mr-2">{stats.name}</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">${stats.revenue.toFixed(0)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Top by Task Count */}
          <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" />
              Most Active Clients
            </h3>
            <div className="space-y-2">
              {sortedByTasks.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No data</p>
              ) : (
                sortedByTasks.map(([_, stats], idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <span className="text-gray-700 dark:text-gray-300 truncate mr-2">{stats.name}</span>
                    <span className="font-semibold text-gray-600 dark:text-gray-400">{stats.taskCount} tasks</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Task Type Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertTriangle className="w-6 h-6 text-red-500 mr-2" />
                <span className="text-sm font-medium text-red-700 dark:text-red-300">Incidents</span>
              </div>
              <span className="text-xl font-bold text-red-600 dark:text-red-400">{incidentCount}</span>
            </div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FileText className="w-6 h-6 text-blue-500 mr-2" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Requests</span>
              </div>
              <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{requestCount}</span>
            </div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Package className="w-6 h-6 text-purple-500 mr-2" />
                <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Supplies</span>
              </div>
              <span className="text-xl font-bold text-purple-600 dark:text-purple-400">{suppliesCount}</span>
            </div>
          </div>
        </div>

        {/* Completed Tasks List */}
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Completed Tasks</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">View-only list of all completed tasks this month</p>
        </div>

        <div className="space-y-4">
          {monthlyTasks
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .map(task => {
            const client = getClient(task.clientId);
            const project = getProject(task.projectId);
            const amount = task.type === 'insumos' 
              ? task.cost || 0
              : (task.hours || 0) * (client?.hourlyRate || 0);
            
            return (
              <div key={task.id} className="border rounded-lg p-4 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700 transition-all duration-200 hover:shadow-md group relative">
                <div className="flex justify-between items-start">
                  <div className="flex items-start space-x-3 flex-1">
                    {getTaskIcon(task.type)}
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="font-medium text-gray-900 dark:text-white">{client?.name}</h3>
                        <span className="text-sm text-gray-500 dark:text-gray-400">•</span>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{project?.name}</p>
                      </div>
                      <p className="text-sm text-gray-600 mt-1 dark:text-gray-300">{task.description}</p>
                      <div className="flex items-center space-x-2 mt-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Completed
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {getRelativeDate(task.date)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
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
                            ${amount.toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => navigate(`/edit-task/${task.id}`, { state: { from: '/monthly' } })}
                      className="p-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200"
                      title="Edit task"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {monthlyTasks.length === 0 && (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">No completed tasks recorded for this month</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                Tasks will appear here once they are completed
              </p>
              <Link
                to="/add-task"
                className="inline-flex items-center mt-4 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add a task
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* PDF Export Modal */}
      {showPdfExport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Export PDF Report
              </h3>
              <button
                onClick={() => setShowPdfExport(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                disabled={isExporting}
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Number of months to include
                </label>
                <select
                  value={pdfMonthCount}
                  onChange={(e) => setPdfMonthCount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  disabled={isExporting}
                >
                  <option value={1}>Current month only</option>
                  <option value={2}>Last 2 months</option>
                  <option value={3}>Last 3 months</option>
                  <option value={6}>Last 6 months</option>
                  <option value={12}>Last 12 months</option>
                </select>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  {pdfMonthCount === 1 ? (
                    <>Report will include <strong>{format(currentDate, 'MMMM yyyy')}</strong></>
                  ) : (
                    <>
                      Report will include {pdfMonthCount} months from{' '}
                      <strong>{format(subMonths(currentDate, pdfMonthCount - 1), 'MMM yyyy')}</strong>{' '}
                      to <strong>{format(currentDate, 'MMM yyyy')}</strong>
                    </>
                  )}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  Includes completed tasks, client analysis, revenue breakdown, and detailed month-by-month reports.
                </p>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowPdfExport(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  disabled={isExporting}
                >
                  Cancel
                </button>
                <button
                  onClick={handlePdfExport}
                  disabled={isExporting}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExporting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileDown className="w-4 h-4 mr-2" />
                      Generate PDF
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}