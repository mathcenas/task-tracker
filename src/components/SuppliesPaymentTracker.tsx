import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Package, DollarSign, Calendar, AlertCircle, CheckCircle, Clock, Filter, CreditCard as Edit2, X } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { api } from '../services/api';

export function SuppliesPaymentTracker() {
  const { tasks, clients, getClient, getProject, refreshTasks } = useApp();
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unbilled' | 'pending' | 'paid'>('all');
  const [editingInvoice, setEditingInvoice] = useState<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');

  // Get all supplies tasks
  const suppliesTasks = tasks.filter(task => task.type === 'insumos');

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let filtered = suppliesTasks;

    // Filter by client
    if (selectedClient !== 'all') {
      filtered = filtered.filter(task => task.clientId === selectedClient);
    }

    // Filter by status
    if (statusFilter === 'unbilled') {
      filtered = filtered.filter(task => !task.billed);
    } else if (statusFilter === 'pending') {
      filtered = filtered.filter(task => task.billed && !task.paid);
    } else if (statusFilter === 'paid') {
      filtered = filtered.filter(task => task.paid);
    }

    return filtered.sort((a, b) => {
      if (a.paid !== b.paid) return a.paid ? 1 : -1;
      if (a.billed !== b.billed) return a.billed ? -1 : 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [suppliesTasks, selectedClient, statusFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    const unbilled = suppliesTasks.filter(t => !t.billed);
    const pending = suppliesTasks.filter(t => t.billed && !t.paid);
    const paid = suppliesTasks.filter(t => t.paid);

    return {
      unbilled: {
        count: unbilled.length,
        total: unbilled.reduce((sum, t) => sum + (t.cost || 0), 0)
      },
      pending: {
        count: pending.length,
        total: pending.reduce((sum, t) => sum + (t.cost || 0), 0)
      },
      paid: {
        count: paid.length,
        total: paid.reduce((sum, t) => sum + (t.cost || 0), 0)
      }
    };
  }, [suppliesTasks]);

  const handleMarkAsBilled = async (taskId: string, invoice: string) => {
    try {
      await api.updateTask(taskId, {
        billed: true,
        billedAt: new Date().toISOString(),
        invoiceNumber: invoice || undefined
      });
      await refreshTasks();
      setEditingInvoice(null);
      setInvoiceNumber('');
    } catch (error) {
      console.error('Error marking as billed:', error);
      alert('Failed to mark as billed');
    }
  };

  const handleMarkAsPaid = async (taskId: string) => {
    try {
      await api.updateTask(taskId, {
        paid: true,
        paidAt: new Date().toISOString()
      });
      await refreshTasks();
    } catch (error) {
      console.error('Error marking as paid:', error);
      alert('Failed to mark as paid');
    }
  };

  const handleUnmarkBilled = async (taskId: string) => {
    try {
      await api.updateTask(taskId, {
        billed: false,
        billedAt: undefined,
        invoiceNumber: undefined
      });
      await refreshTasks();
    } catch (error) {
      console.error('Error unmarking billed:', error);
      alert('Failed to unmark');
    }
  };

  const handleUnmarkPaid = async (taskId: string) => {
    try {
      await api.updateTask(taskId, {
        paid: false,
        paidAt: undefined
      });
      await refreshTasks();
    } catch (error) {
      console.error('Error unmarking paid:', error);
      alert('Failed to unmark');
    }
  };

  const getDaysOverdue = (billedAt: string | undefined) => {
    if (!billedAt) return 0;
    return differenceInDays(new Date(), parseISO(billedAt));
  };

  const getStatusBadge = (task: any) => {
    if (task.paid) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400">
          <CheckCircle className="w-3 h-3 mr-1" />
          Paid
        </span>
      );
    }
    if (task.billed) {
      const daysOverdue = getDaysOverdue(task.billedAt);
      const isOverdue = daysOverdue > 30;
      return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
          isOverdue
            ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400'
            : 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400'
        }`}>
          <Clock className="w-3 h-3 mr-1" />
          Pending {isOverdue && `(${daysOverdue} days)`}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-400">
        <AlertCircle className="w-3 h-3 mr-1" />
        Not Billed
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Supplies Payment Tracker</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Track billing and payment status</p>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Filter className="w-4 h-4 inline mr-1" />
                Filter by Status
              </label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="block w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="unbilled">Not Billed</option>
                <option value="pending">Pending Payment</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Not Billed</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  ${stats.unbilled.total.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {stats.unbilled.count} supplies
                </p>
              </div>
              <div className="p-3 bg-gray-100 dark:bg-gray-900/20 rounded-lg">
                <AlertCircle className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending Payment</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-2">
                  ${stats.pending.total.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {stats.pending.count} supplies
                </p>
              </div>
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Paid</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">
                  ${stats.paid.total.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {stats.paid.count} supplies
                </p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Supplies List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Supplies ({filteredTasks.length})
          </h3>

          {filteredTasks.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">No supplies found</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                Try adjusting your filters
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map(task => {
                const client = getClient(task.clientId);
                const project = getProject(task.projectId);
                const isEditing = editingInvoice === task.id;

                return (
                  <div
                    key={task.id}
                    className="flex items-start justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded">
                        <Package className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium text-gray-900 dark:text-white">{client?.name}</h4>
                          <span className="text-sm text-gray-500 dark:text-gray-400">•</span>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{project?.name}</p>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{task.description}</p>
                        <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            {format(parseISO(task.date), 'MMM d, yyyy')}
                          </span>
                          {task.invoiceNumber && (
                            <span>Invoice: {task.invoiceNumber}</span>
                          )}
                          {task.billedAt && (
                            <span>Billed: {format(parseISO(task.billedAt), 'MMM d, yyyy')}</span>
                          )}
                          {task.paidAt && (
                            <span>Paid: {format(parseISO(task.paidAt), 'MMM d, yyyy')}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 ml-4">
                      <div className="text-right mr-3">
                        <p className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                          ${task.cost?.toFixed(2)}
                        </p>
                        {getStatusBadge(task)}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col space-y-2">
                        {!task.billed && !isEditing && (
                          <button
                            onClick={() => {
                              setEditingInvoice(task.id);
                              setInvoiceNumber('');
                            }}
                            className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                          >
                            Mark as Billed
                          </button>
                        )}

                        {isEditing && (
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              placeholder="Invoice #"
                              value={invoiceNumber}
                              onChange={(e) => setInvoiceNumber(e.target.value)}
                              className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white w-24"
                            />
                            <button
                              onClick={() => handleMarkAsBilled(task.id, invoiceNumber)}
                              className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingInvoice(null);
                                setInvoiceNumber('');
                              }}
                              className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {task.billed && !task.paid && (
                          <>
                            <button
                              onClick={() => handleMarkAsPaid(task.id)}
                              className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                            >
                              Mark as Paid
                            </button>
                            <button
                              onClick={() => handleUnmarkBilled(task.id)}
                              className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
                            >
                              Unmark Billed
                            </button>
                          </>
                        )}

                        {task.paid && (
                          <button
                            onClick={() => handleUnmarkPaid(task.id)}
                            className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
                          >
                            Unmark Paid
                          </button>
                        )}
                      </div>
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
