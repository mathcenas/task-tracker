import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate, Link } from 'react-router-dom';
import { Package, DollarSign, Calendar, Filter, CreditCard as Edit, Download, TrendingUp, ShoppingCart, CheckSquare, User, Store, Receipt, RefreshCw, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { format, parseISO, startOfYear, endOfYear, isWithinInterval, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { exportTasksToCSV } from '../utils/csvExport';
import { api } from '../services/api';

export function SuppliesPage() {
  const { tasks, clients, getClient, getProject, refreshTasks } = useApp();
  const navigate = useNavigate();
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedApprovalStatus, setSelectedApprovalStatus] = useState<string>('all');

  // Analytics month — defaults to current month, user can navigate
  const [analyticsMonth, setAnalyticsMonth] = useState<Date>(startOfMonth(new Date()));

  const suppliesTasks = tasks.filter(task => task.type === 'insumos');

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    suppliesTasks.forEach(task => years.add(new Date(task.date).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [suppliesTasks]);

  // List filter (year + client + approval)
  const filteredTasks = useMemo(() => {
    let filtered = suppliesTasks;
    if (selectedClient !== 'all') {
      filtered = filtered.filter(task => String(task.clientId) === String(selectedClient));
    }
    if (selectedYear !== 'all') {
      const yearStart = startOfYear(new Date(parseInt(selectedYear), 0, 1));
      const yearEnd = endOfYear(new Date(parseInt(selectedYear), 0, 1));
      filtered = filtered.filter(task =>
        isWithinInterval(parseISO(task.date), { start: yearStart, end: yearEnd })
      );
    }
    if (selectedApprovalStatus !== 'all') {
      if (selectedApprovalStatus === 'none') {
        filtered = filtered.filter(task => !task.approvalStatus || task.approvalStatus === 'pending');
      } else {
        filtered = filtered.filter(task => task.approvalStatus === selectedApprovalStatus);
      }
    }
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [suppliesTasks, selectedClient, selectedYear, selectedApprovalStatus]);

  // Aggregate stats for filter view
  const totalCost = filteredTasks.reduce((sum, t) => sum + (t.cost || 0), 0);
  const averageCost = filteredTasks.length > 0 ? totalCost / filteredTasks.length : 0;
  const fixedCount = filteredTasks.filter(t => t.isRecurring).length;
  const pendingApprovalCount = filteredTasks.filter(t => !t.approvalStatus || t.approvalStatus === 'pending').length;

  // Analytics: selected month vs prev month, respect client filter
  const analyticsMonthEnd = endOfMonth(analyticsMonth);
  const prevMonth = subMonths(analyticsMonth, 1);
  const prevMonthEnd = endOfMonth(prevMonth);

  const analyticsBase = selectedClient === 'all'
    ? suppliesTasks
    : suppliesTasks.filter(t => String(t.clientId) === String(selectedClient));

  const thisMonthTasks = useMemo(() =>
    analyticsBase.filter(t => isWithinInterval(parseISO(t.date), { start: analyticsMonth, end: analyticsMonthEnd })),
    [analyticsBase, analyticsMonth]
  );
  const prevMonthTasks = useMemo(() =>
    analyticsBase.filter(t => isWithinInterval(parseISO(t.date), { start: prevMonth, end: prevMonthEnd })),
    [analyticsBase, prevMonth]
  );

  const thisMonthCost = thisMonthTasks.reduce((s, t) => s + (t.cost || 0), 0);
  const prevMonthCost = prevMonthTasks.reduce((s, t) => s + (t.cost || 0), 0);
  const thisMonthFixed = thisMonthTasks.filter(t => t.isRecurring).reduce((s, t) => s + (t.cost || 0), 0);
  const thisMonthOneOff = thisMonthCost - thisMonthFixed;
  const monthDelta = prevMonthCost > 0 ? ((thisMonthCost - prevMonthCost) / prevMonthCost) * 100 : null;

  // Per-client breakdown for selected analytics month
  const byClientThisMonth = useMemo(() => {
    const map: Record<string, { name: string; cost: number; count: number; fixed: number }> = {};
    thisMonthTasks.forEach(t => {
      const client = getClient(t.clientId);
      if (!client) return;
      const key = String(t.clientId);
      if (!map[key]) map[key] = { name: client.name, cost: 0, count: 0, fixed: 0 };
      map[key].cost += t.cost || 0;
      map[key].count += 1;
      if (t.isRecurring) map[key].fixed += t.cost || 0;
    });
    return Object.values(map).sort((a, b) => b.cost - a.cost);
  }, [thisMonthTasks, getClient]);

  // Monthly bar chart: last 6 months relative to analyticsMonth
  const last6Months = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const m = subMonths(analyticsMonth, 5 - i);
      const mEnd = endOfMonth(m);
      const mTasks = analyticsBase.filter(t => isWithinInterval(parseISO(t.date), { start: m, end: mEnd }));
      return {
        label: format(m, 'MMM'),
        cost: mTasks.reduce((s, t) => s + (t.cost || 0), 0),
        isSelected: format(m, 'yyyy-MM') === format(analyticsMonth, 'yyyy-MM'),
      };
    });
  }, [analyticsBase, analyticsMonth]);

  const maxBar = Math.max(...last6Months.map(m => m.cost), 0.01);

  const handleExport = () => {
    const filename = `supplies-${selectedClient === 'all' ? 'all' : getClient(selectedClient)?.name || 'unknown'}-${selectedYear}.csv`;
    exportTasksToCSV(filteredTasks, getClient, getProject, filename);
  };

  const handleToggleSelect = (taskId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(taskId)) newSelected.delete(taskId);
    else newSelected.add(taskId);
    setSelectedItems(newSelected);
  };

  const handleSelectAll = () => {
    setSelectedItems(selectedItems.size === filteredTasks.length ? new Set() : new Set(filteredTasks.map(t => t.id)));
  };

  const handleMarkSelectedAsBilled = async () => {
    if (selectedItems.size === 0) return;
    const invoiceNum = prompt('Enter invoice number (optional):');
    if (invoiceNum === null) return;
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
    } catch (error) {
      console.error('Error marking as billed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header + Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-slate-100 dark:bg-slate-900/30 rounded-lg">
                <Package className="w-6 h-6 text-slate-600 dark:text-slate-400" />
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="client-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Filter className="w-4 h-4 inline mr-1" />Filter by Client
              </label>
              <select
                id="client-filter"
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="block w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="all">All Clients</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="year-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />Filter by Year
              </label>
              <select
                id="year-filter"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="block w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="all">All Years</option>
                {availableYears.map(year => (
                  <option key={year} value={year.toString()}>{year}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="approval-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <CheckSquare className="w-4 h-4 inline mr-1" />Approval Status
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

        {/* Summary stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Supplies</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{filteredTasks.length}</p>
                {fixedCount > 0 && <p className="text-xs text-teal-600 dark:text-teal-400 mt-1">{fixedCount} fixed monthly</p>}
              </div>
              <div className="p-2.5 bg-slate-100 dark:bg-slate-900/30 rounded-lg">
                <ShoppingCart className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Cost</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">${totalCost.toFixed(2)}</p>
              </div>
              <div className="p-2.5 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Avg Cost</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">${averageCost.toFixed(2)}</p>
              </div>
              <div className="p-2.5 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pending Approval</p>
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-1">{pendingApprovalCount}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{filteredTasks.length - pendingApprovalCount} resolved</p>
              </div>
              <div className="p-2.5 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                <CheckSquare className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Unified Analytics Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          {/* Month navigator */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAnalyticsMonth(m => subMonths(m, 1))}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white min-w-[140px] text-center">
                {format(analyticsMonth, 'MMMM yyyy')}
              </h3>
              <button
                onClick={() => setAnalyticsMonth(m => addMonths(m, 1))}
                disabled={format(addMonths(analyticsMonth, 1), 'yyyy-MM') > format(new Date(), 'yyyy-MM')}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              {format(analyticsMonth, 'yyyy-MM') !== format(startOfMonth(new Date()), 'yyyy-MM') && (
                <button
                  onClick={() => setAnalyticsMonth(startOfMonth(new Date()))}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline ml-1"
                >
                  Today
                </button>
              )}
            </div>
            {monthDelta !== null && (
              <div className={`flex items-center gap-1 text-sm font-medium px-2.5 py-1 rounded-full ${
                monthDelta > 0
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                  : monthDelta < 0
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              }`}>
                {monthDelta > 0 ? <ArrowUp className="w-3.5 h-3.5" /> : monthDelta < 0 ? <ArrowDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                <span>{Math.abs(monthDelta).toFixed(1)}% vs {format(prevMonth, 'MMM')}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: month summary + bar chart */}
            <div>
              {/* Three mini tiles */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="p-3 bg-slate-50 dark:bg-slate-900/30 rounded-lg text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">${thisMonthCost.toFixed(2)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{thisMonthTasks.length} items</p>
                </div>
                <div className="p-3 bg-teal-50 dark:bg-teal-900/20 rounded-lg text-center">
                  <p className="text-xs text-teal-600 dark:text-teal-400 mb-1">Fixed</p>
                  <p className="text-xl font-bold text-teal-700 dark:text-teal-300">${thisMonthFixed.toFixed(2)}</p>
                  <p className="text-xs text-teal-500 mt-0.5">{thisMonthTasks.filter(t => t.isRecurring).length} items</p>
                </div>
                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-center">
                  <p className="text-xs text-orange-600 dark:text-orange-400 mb-1">One-off</p>
                  <p className="text-xl font-bold text-orange-700 dark:text-orange-300">${thisMonthOneOff.toFixed(2)}</p>
                  <p className="text-xs text-orange-500 mt-0.5">{thisMonthTasks.filter(t => !t.isRecurring).length} items</p>
                </div>
              </div>

              {/* 6-month bar chart */}
              <div>
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Last 6 months</p>
                <div className="flex items-end gap-2 h-24">
                  {last6Months.map((m, i) => (
                    <button
                      key={i}
                      onClick={() => setAnalyticsMonth(subMonths(analyticsMonth, 5 - i))}
                      className="flex-1 flex flex-col items-center gap-1 group"
                      title={`${m.label}: $${m.cost.toFixed(2)}`}
                    >
                      <span className="text-xs text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        ${m.cost > 0 ? m.cost.toFixed(0) : ''}
                      </span>
                      <div className="w-full flex flex-col justify-end" style={{ height: '64px' }}>
                        <div
                          className={`w-full rounded-t transition-all duration-300 ${
                            m.isSelected
                              ? 'bg-blue-500 dark:bg-blue-400'
                              : 'bg-gray-200 dark:bg-gray-700 group-hover:bg-blue-300 dark:group-hover:bg-blue-600'
                          }`}
                          style={{ height: m.cost > 0 ? `${Math.max((m.cost / maxBar) * 64, 4)}px` : '4px' }}
                        />
                      </div>
                      <span className={`text-xs ${m.isSelected ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-gray-400 dark:text-gray-500'}`}>
                        {m.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: per-client breakdown */}
            <div>
              <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">By Client — {format(analyticsMonth, 'MMM yyyy')}</p>
              {byClientThisMonth.length > 0 ? (
                <div className="space-y-2">
                  {byClientThisMonth.map(c => {
                    const pct = thisMonthCost > 0 ? (c.cost / thisMonthCost) * 100 : 0;
                    return (
                      <div key={c.name}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700 dark:text-gray-300 truncate flex-1 mr-2">{c.name}</span>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs text-gray-400">{c.count} item{c.count !== 1 ? 's' : ''}</span>
                            <span className="font-semibold text-gray-900 dark:text-white w-20 text-right">${c.cost.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full bg-blue-400 dark:bg-blue-500 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-sm text-gray-400 dark:text-gray-500">
                  No supplies in {format(analyticsMonth, 'MMMM yyyy')}
                </div>
              )}
            </div>
          </div>
        </div>

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
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Try adjusting your filters or add new supplies</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map(task => {
                const client = getClient(task.clientId);
                const project = getProject(task.projectId);
                const isSelected = selectedItems.has(task.id);

                const approvalBadge = () => {
                  if (task.approvalStatus === 'approved')
                    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Approved</span>;
                  if (task.approvalStatus === 'rejected')
                    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Rejected</span>;
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
                              <Store className="w-3 h-3 mr-1" />{task.vendor}
                            </span>
                          )}
                          {task.approvedBy && (
                            <span className="flex items-center">
                              <User className="w-3 h-3 mr-1" />Approved by: {task.approvedBy}
                            </span>
                          )}
                          {task.receiptRef && (
                            <span className="flex items-center">
                              <Receipt className="w-3 h-3 mr-1" />Ref: {task.receiptRef}
                            </span>
                          )}
                          {task.notes && (
                            <span className="truncate max-w-xs" title={task.notes}>Note: {task.notes}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 ml-4 flex-shrink-0">
                      <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                        ${task.cost?.toFixed(2)}
                      </p>
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
