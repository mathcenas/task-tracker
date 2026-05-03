import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate, Link } from 'react-router-dom';
import { Package, DollarSign, Calendar, Filter, CreditCard as Edit, Download, TrendingUp, ShoppingCart, CheckSquare, User, Store, Receipt, RefreshCw, BarChart2, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { format, parseISO, startOfYear, endOfYear, isWithinInterval, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { exportTasksToCSV } from '../utils/csvExport';
import { api } from '../services/api';

export function SuppliesPage() {
  const { tasks, clients, getClient, getProject, refreshTasks } = useApp();
  const navigate = useNavigate();
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedApprovalStatus, setSelectedApprovalStatus] = useState<string>('all');

  // Get all supplies tasks
  const suppliesTasks = tasks.filter(task => task.type === 'insumos');

  // Get available years from tasks
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    suppliesTasks.forEach(task => {
      const year = new Date(task.date).getFullYear();
      years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [suppliesTasks]);

  // Filter tasks by client and year
  const filteredTasks = useMemo(() => {
    let filtered = suppliesTasks;

    // Filter by client
    if (selectedClient !== 'all') {
      filtered = filtered.filter(task => task.clientId === selectedClient);
    }

    // Filter by year
    if (selectedYear !== 'all') {
      const yearStart = startOfYear(new Date(parseInt(selectedYear), 0, 1));
      const yearEnd = endOfYear(new Date(parseInt(selectedYear), 0, 1));
      filtered = filtered.filter(task =>
        isWithinInterval(parseISO(task.date), { start: yearStart, end: yearEnd })
      );
    }

    // Filter by approval status
    if (selectedApprovalStatus !== 'all') {
      if (selectedApprovalStatus === 'none') {
        filtered = filtered.filter(task => !task.approvalStatus || task.approvalStatus === 'pending');
      } else {
        filtered = filtered.filter(task => task.approvalStatus === selectedApprovalStatus);
      }
    }

    // Sort by date (newest first)
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [suppliesTasks, selectedClient, selectedYear, selectedApprovalStatus]);

  // Calculate statistics
  const totalCost = filteredTasks.reduce((sum, task) => sum + (task.cost || 0), 0);
  const averageCost = filteredTasks.length > 0 ? totalCost / filteredTasks.length : 0;
  const fixedCount = filteredTasks.filter(t => t.isRecurring).length;
  const pendingApprovalCount = filteredTasks.filter(t => !t.approvalStatus || t.approvalStatus === 'pending').length;

  // Group by client for summary
  const clientSummary = useMemo(() => {
    const summary: Record<string, { name: string; count: number; total: number }> = {};

    filteredTasks.forEach(task => {
      const client = getClient(task.clientId);
      if (!client) return;

      if (!summary[task.clientId]) {
        summary[task.clientId] = {
          name: client.name,
          count: 0,
          total: 0
        };
      }

      summary[task.clientId].count += 1;
      summary[task.clientId].total += task.cost || 0;
    });

    return Object.entries(summary).sort((a, b) => b[1].total - a[1].total);
  }, [filteredTasks, getClient]);

  // Group by month for the selected year
  const monthlyBreakdown = useMemo(() => {
    if (selectedYear === 'all') return [];

    const months: Record<string, { month: string; count: number; total: number }> = {};

    filteredTasks.forEach(task => {
      const monthKey = format(parseISO(task.date), 'yyyy-MM');
      const monthLabel = format(parseISO(task.date), 'MMMM yyyy');

      if (!months[monthKey]) {
        months[monthKey] = {
          month: monthLabel,
          count: 0,
          total: 0
        };
      }

      months[monthKey].count += 1;
      months[monthKey].total += task.cost || 0;
    });

    return Object.entries(months)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([_, data]) => data);
  }, [filteredTasks, selectedYear]);

  // Current-month running cost (always against all supplies, not filtered)
  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  const thisMonthTasks = useMemo(() => suppliesTasks.filter(t =>
    isWithinInterval(parseISO(t.date), { start: thisMonthStart, end: thisMonthEnd }) &&
    (selectedClient === 'all' || t.clientId === selectedClient)
  ), [suppliesTasks, selectedClient]);

  const lastMonthTasks = useMemo(() => suppliesTasks.filter(t =>
    isWithinInterval(parseISO(t.date), { start: lastMonthStart, end: lastMonthEnd }) &&
    (selectedClient === 'all' || t.clientId === selectedClient)
  ), [suppliesTasks, selectedClient]);

  const thisMonthCost = thisMonthTasks.reduce((s, t) => s + (t.cost || 0), 0);
  const lastMonthCost = lastMonthTasks.reduce((s, t) => s + (t.cost || 0), 0);
  const thisMonthFixed = thisMonthTasks.filter(t => t.isRecurring).reduce((s, t) => s + (t.cost || 0), 0);
  const thisMonthOneOff = thisMonthCost - thisMonthFixed;

  // % change vs last month
  const monthDelta = lastMonthCost > 0 ? ((thisMonthCost - lastMonthCost) / lastMonthCost) * 100 : null;

  // Per-client breakdown for current month
  const thisMonthByClient = useMemo(() => {
    const map: Record<string, { name: string; cost: number; count: number }> = {};
    thisMonthTasks.forEach(t => {
      const client = getClient(t.clientId);
      if (!client) return;
      if (!map[t.clientId]) map[t.clientId] = { name: client.name, cost: 0, count: 0 };
      map[t.clientId].cost += t.cost || 0;
      map[t.clientId].count += 1;
    });
    return Object.values(map).sort((a, b) => b.cost - a.cost);
  }, [thisMonthTasks, getClient]);

  const handleExport = () => {
    const filename = `supplies-${selectedClient === 'all' ? 'all' : getClient(selectedClient)?.name || 'unknown'}-${selectedYear}.csv`;
    exportTasksToCSV(filteredTasks, getClient, getProject, filename);
  };

  const handleToggleSelect = (taskId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedItems.size === filteredTasks.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredTasks.map(t => t.id)));
    }
  };

  const handleMarkSelectedAsBilled = async () => {
    if (selectedItems.size === 0) return;

    const invoiceNum = prompt('Enter invoice number (optional):');
    if (invoiceNum === null) return; // User cancelled

    try {
      for (const taskId of Array.from(selectedItems)) {
        await api.updateTask(taskId, {
          billed: true,
          billedAt: new Date().toISOString(),
          invoiceNumber: invoiceNum || undefined
        });
      }
      await refreshTasks();
      setSelectedItems(new Set());
      alert(`✅ Marked ${selectedItems.size} supplies as billed`);
    } catch (error) {
      console.error('Error marking as billed:', error);
      alert('Failed to mark supplies as billed');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <Package className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Supplies Tracker</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Track all purchases and supplies</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Link
                to="/supplies/payments"
                className="inline-flex items-center px-4 py-2 border border-blue-600 dark:border-blue-500 rounded-lg shadow-sm text-sm font-medium text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Payment Tracker
              </Link>
              <button
                onClick={handleExport}
                disabled={filteredTasks.length === 0}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="client-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Filter className="w-4 h-4 inline mr-1" />
                Filter by Client
              </label>
              <select
                id="client-filter"
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="block w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="all">All Clients</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="year-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Filter by Year
              </label>
              <select
                id="year-filter"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="block w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="all">All Years</option>
                {availableYears.map(year => (
                  <option key={year} value={year.toString()}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="approval-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <CheckSquare className="w-4 h-4 inline mr-1" />
                Approval Status
              </label>
              <select
                id="approval-filter"
                value={selectedApprovalStatus}
                onChange={(e) => setSelectedApprovalStatus(e.target.value)}
                className="block w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="none">Pending / No Status</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Supplies</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {filteredTasks.length}
                </p>
                {fixedCount > 0 && (
                  <p className="text-xs text-teal-600 dark:text-teal-400 mt-1">{fixedCount} fixed monthly</p>
                )}
              </div>
              <div className="p-3 bg-slate-100 dark:bg-slate-900/30 rounded-lg">
                <ShoppingCart className="w-6 h-6 text-slate-600 dark:text-slate-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Cost</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  ${totalCost.toFixed(2)}
                </p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Average Cost</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  ${averageCost.toFixed(2)}
                </p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending Approval</p>
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-2">
                  {pendingApprovalCount}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {filteredTasks.length - pendingApprovalCount} approved/rejected
                </p>
              </div>
              <div className="p-3 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                <CheckSquare className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Current Month Running Cost */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <BarChart2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {format(now, 'MMMM yyyy')} — Running Cost
              </h3>
            </div>
            {monthDelta !== null && (
              <div className={`flex items-center space-x-1 text-sm font-medium px-2.5 py-1 rounded-full ${
                monthDelta > 0
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                  : monthDelta < 0
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              }`}>
                {monthDelta > 0 ? <ArrowUp className="w-3.5 h-3.5" /> : monthDelta < 0 ? <ArrowDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                <span>{Math.abs(monthDelta).toFixed(1)}% vs last month</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <div className="p-4 bg-slate-50 dark:bg-slate-900/30 rounded-lg">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Total This Month</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">${thisMonthCost.toFixed(2)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{thisMonthTasks.length} purchase{thisMonthTasks.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="p-4 bg-teal-50 dark:bg-teal-900/20 rounded-lg">
              <p className="text-xs font-medium text-teal-600 dark:text-teal-400 uppercase tracking-wide mb-1">Fixed / Recurring</p>
              <p className="text-2xl font-bold text-teal-700 dark:text-teal-300">${thisMonthFixed.toFixed(2)}</p>
              <p className="text-xs text-teal-600 dark:text-teal-500 mt-1">{thisMonthTasks.filter(t => t.isRecurring).length} items</p>
            </div>
            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <p className="text-xs font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wide mb-1">One-off</p>
              <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">${thisMonthOneOff.toFixed(2)}</p>
              <p className="text-xs text-orange-600 dark:text-orange-500 mt-1">{thisMonthTasks.filter(t => !t.isRecurring).length} items</p>
            </div>
          </div>

          {/* vs last month bar */}
          {(thisMonthCost > 0 || lastMonthCost > 0) && (
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>This month</span>
                <span>Last month: ${lastMonthCost.toFixed(2)}</span>
              </div>
              {(() => {
                const max = Math.max(thisMonthCost, lastMonthCost, 0.01);
                return (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-20 text-xs text-right text-gray-500 dark:text-gray-400 shrink-0">{format(now, 'MMM')}</div>
                      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${(thisMonthCost / max) * 100}%` }}
                        />
                      </div>
                      <div className="w-20 text-xs text-gray-700 dark:text-gray-300 font-medium shrink-0">${thisMonthCost.toFixed(2)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 text-xs text-right text-gray-500 dark:text-gray-400 shrink-0">{format(subMonths(now, 1), 'MMM')}</div>
                      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                        <div
                          className="h-full bg-gray-400 dark:bg-gray-500 rounded-full transition-all duration-500"
                          style={{ width: `${(lastMonthCost / max) * 100}%` }}
                        />
                      </div>
                      <div className="w-20 text-xs text-gray-500 dark:text-gray-400 shrink-0">${lastMonthCost.toFixed(2)}</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Per-client breakdown */}
          {thisMonthByClient.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">By Client</p>
              <div className="space-y-2">
                {thisMonthByClient.map(c => (
                  <div key={c.name} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">{c.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">{c.count} item{c.count !== 1 ? 's' : ''}</span>
                      <span className="font-semibold text-gray-900 dark:text-white w-20 text-right">${c.cost.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {thisMonthTasks.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-2">No supplies recorded this month yet.</p>
          )}
        </div>

        {/* Client Summary */}
        {selectedClient === 'all' && clientSummary.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">By Client</h3>
            <div className="space-y-3">
              {clientSummary.map(([clientId, data]) => (
                <div key={clientId} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">{data.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{data.count} supplies</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-purple-600 dark:text-purple-400">${data.total.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Monthly Breakdown */}
        {selectedYear !== 'all' && monthlyBreakdown.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Monthly Breakdown - {selectedYear}</h3>
            <div className="space-y-3">
              {monthlyBreakdown.map((month, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">{month.month}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{month.count} supplies</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-purple-600 dark:text-purple-400">${month.total.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Supplies List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Supplies List ({filteredTasks.length})
              {selectedItems.size > 0 && (
                <span className="ml-2 text-sm font-normal text-blue-600 dark:text-blue-400">
                  ({selectedItems.size} selected)
                </span>
              )}
            </h3>

            {filteredTasks.length > 0 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSelectAll}
                  className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  {selectedItems.size === filteredTasks.length ? 'Deselect All' : 'Select All'}
                </button>
                {selectedItems.size > 0 && (
                  <button
                    onClick={handleMarkSelectedAsBilled}
                    className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                  >
                    <CheckSquare className="w-4 h-4 mr-1" />
                    Mark as Billed ({selectedItems.size})
                  </button>
                )}
              </div>
            )}
          </div>

          {filteredTasks.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">No supplies found</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                Try adjusting your filters or add new supplies
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map(task => {
                const client = getClient(task.clientId);
                const project = getProject(task.projectId);
                const isSelected = selectedItems.has(task.id);

                const approvalBadge = () => {
                  if (task.approvalStatus === 'approved') {
                    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Approved</span>;
                  }
                  if (task.approvalStatus === 'rejected') {
                    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Rejected</span>;
                  }
                  return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">Pending</span>;
                };

                return (
                  <div
                    key={task.id}
                    className={`flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group ${
                      isSelected
                        ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/10'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-start space-x-3 flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(task.id)}
                        className="mt-1 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                      />
                      <div className="p-2 bg-slate-100 dark:bg-slate-900/30 rounded flex-shrink-0">
                        <Package className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2 mb-1">
                          <h4 className="font-medium text-gray-900 dark:text-white">{client?.name}</h4>
                          <span className="text-sm text-gray-400">•</span>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{project?.name}</p>
                          {approvalBadge()}
                          {task.isRecurring && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400">
                              <RefreshCw className="w-3 h-3 mr-1" />
                              Fixed Monthly
                            </span>
                          )}
                          {task.billed && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Billed</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{task.description}</p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            {format(parseISO(task.date), 'MMM d, yyyy')}
                          </span>
                          {task.vendor && (
                            <span className="flex items-center">
                              <Store className="w-3 h-3 mr-1" />
                              {task.vendor}
                            </span>
                          )}
                          {task.approvedBy && (
                            <span className="flex items-center">
                              <User className="w-3 h-3 mr-1" />
                              Approved by: {task.approvedBy}
                            </span>
                          )}
                          {task.receiptRef && (
                            <span className="flex items-center">
                              <Receipt className="w-3 h-3 mr-1" />
                              Ref: {task.receiptRef}
                            </span>
                          )}
                          {task.notes && (
                            <span className="truncate max-w-xs" title={task.notes}>
                              Note: {task.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 ml-4 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                          ${task.cost?.toFixed(2)}
                        </p>
                      </div>
                      <button
                        onClick={() => navigate(`/edit-task/${task.id}`, { state: { from: '/supplies' } })}
                        className="p-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                        title="Edit supply"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
