import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { format } from 'date-fns';
import { ArrowLeft, Save, Trash2, RefreshCw, UserCheck, Store, Receipt } from 'lucide-react';

export function EditTask() {
  const navigate = useNavigate();
  const location = useLocation();
  const { taskId } = useParams<{ taskId: string }>();
  const { getTask, updateTask, deleteTask, clients, projects, getClient, getProject } = useApp();

  const returnPath = (location.state as { from?: string })?.from || '/';

  React.useEffect(() => {
    if (location.state?.from) {
      sessionStorage.setItem('lastDashboardPath', location.state.from);
    }
  }, [location.state]);

  const task = taskId ? getTask(taskId) : null;

  const [formData, setFormData] = useState({
    clientId: '',
    projectId: '',
    description: '',
    hours: '',
    cost: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'request' as 'incident' | 'request' | 'insumos',
    status: 'in_progress' as 'not_started' | 'in_progress' | 'review' | 'completed',
    priority: 'medium' as 'low' | 'medium' | 'high',
    notes: '',
    finished: false,
    isRecurring: false,
    approvedBy: '',
    vendor: '',
    receiptRef: '',
    approvalStatus: 'pending' as 'pending' | 'approved' | 'rejected'
  });

  useEffect(() => {
    if (task) {
      setFormData({
        clientId: task.clientId,
        projectId: task.projectId,
        description: task.description,
        hours: task.hours?.toString() || '',
        cost: task.cost?.toString() || '',
        date: task.date,
        type: task.type,
        status: task.status,
        priority: task.priority,
        notes: task.notes || '',
        finished: task.finished,
        isRecurring: task.isRecurring || false,
        approvedBy: task.approvedBy || '',
        vendor: task.vendor || '',
        receiptRef: task.receiptRef || '',
        approvalStatus: task.approvalStatus || 'pending'
      });
    }
  }, [task]);

  const availableProjects = useMemo(() => {
    if (!formData.clientId) return [];
    return projects.filter(p => p.clientId === formData.clientId);
  }, [projects, formData.clientId]);

  if (!task) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-md border border-gray-200 dark:border-gray-700 p-6 dark:bg-gray-800">
          <p className="text-gray-500 dark:text-gray-400">Task not found</p>
          <button
            onClick={() => navigate(returnPath)}
            className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>
        </div>
      </div>
    );
  }

  const project = getProject(formData.projectId || task.projectId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isFinished = formData.type === 'insumos' ? true : (formData.hours ? true : formData.finished);

    const updatedTask = {
      ...task,
      clientId: formData.clientId,
      projectId: formData.projectId,
      description: formData.description,
      hours: formData.type !== 'insumos' ? (formData.hours ? Number(formData.hours) : undefined) : undefined,
      cost: formData.type === 'insumos' ? Number(formData.cost) : undefined,
      date: formData.date,
      type: formData.type,
      status: isFinished ? 'completed' : formData.status,
      priority: formData.priority,
      notes: formData.notes,
      finished: isFinished,
      isRecurring: formData.isRecurring,
      ...(formData.type === 'insumos' ? {
        approvedBy: formData.approvedBy || undefined,
        vendor: formData.vendor || undefined,
        receiptRef: formData.receiptRef || undefined,
        approvalStatus: formData.approvalStatus
      } : {})
    };

    try {
      await updateTask(updatedTask);
      const finalPath = returnPath === '/' ? (sessionStorage.getItem('lastDashboardPath') || '/') : returnPath;
      navigate(finalPath);
    } catch (error) {
      console.error('Failed to update task:', error);
      alert('Failed to save changes. Please try again.');
    }
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      deleteTask(task.id);
      const finalPath = returnPath === '/' ? (sessionStorage.getItem('lastDashboardPath') || '/') : returnPath;
      navigate(finalPath);
    }
  };

  const approvalStatusConfig = {
    pending: { label: 'Pending Approval', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300 dark:border-amber-700' },
    approved: { label: 'Approved', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-300 dark:border-green-700' },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-300 dark:border-red-700' }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-md border border-gray-200 dark:border-gray-700 p-6 dark:bg-gray-800">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate(returnPath)}
              className="p-2 hover:bg-gray-100 rounded-lg dark:hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Edit Task</h2>
          </div>
          <button
            onClick={handleDelete}
            className="inline-flex items-center px-3 py-2 border border-red-300 rounded-lg text-sm font-medium text-red-700 bg-white hover:bg-red-50 dark:border-red-600 dark:bg-gray-700 dark:text-red-400 dark:hover:bg-red-900/20 transition-all duration-200"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </button>
        </div>

        {/* Client & Project */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="clientId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Client
            </label>
            <select
              id="clientId"
              required
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all duration-200"
              value={formData.clientId}
              onChange={(e) => {
                const newClientId = e.target.value;
                const clientProjects = projects.filter(p => p.clientId === newClientId);
                setFormData(prev => ({
                  ...prev,
                  clientId: newClientId,
                  projectId: clientProjects.length > 0 ? clientProjects[0].id : prev.projectId
                }));
              }}
            >
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="projectId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Project
            </label>
            <select
              id="projectId"
              required
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all duration-200"
              value={formData.projectId}
              onChange={(e) => setFormData(prev => ({ ...prev, projectId: e.target.value }))}
            >
              {availableProjects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              {availableProjects.length === 0 && project && (
                <option value={project.id}>{project.name}</option>
              )}
            </select>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Task Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Task Type
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['incident', 'request', 'insumos'] as const).map((t) => (
                <label key={t} className="relative">
                  <input
                    type="radio"
                    className="sr-only peer"
                    name="type"
                    value={t}
                    checked={formData.type === t}
                    onChange={() => setFormData(prev => ({ ...prev, type: t }))}
                  />
                  <div className={`p-3 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 ${
                    t === 'incident' ? 'peer-checked:border-red-500 peer-checked:bg-red-50 dark:peer-checked:bg-red-900/20 dark:peer-checked:border-red-500' :
                    t === 'request' ? 'peer-checked:border-blue-500 peer-checked:bg-blue-50 dark:peer-checked:bg-blue-900/20 dark:peer-checked:border-blue-500' :
                    'peer-checked:border-teal-500 peer-checked:bg-teal-50 dark:peer-checked:bg-teal-900/20 dark:peer-checked:border-teal-500'
                  }`}>
                    <div className="text-center">
                      <div className={`font-medium ${
                        t === 'incident' ? 'text-red-500' : t === 'request' ? 'text-blue-500' : 'text-teal-600'
                      }`}>
                        {t === 'insumos' ? 'Supplies' : t.charAt(0).toUpperCase() + t.slice(1)}
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Description
            </label>
            <textarea
              id="description"
              required
              rows={3}
              className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all duration-200"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the task..."
            />
          </div>

          {/* Hours or Cost */}
          {formData.type !== 'insumos' ? (
            <div>
              <label htmlFor="hours" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Hours {formData.finished ? '(completed)' : '(optional — leave empty to complete later)'}
              </label>
              <input
                type="number"
                id="hours"
                min="0.25"
                step="0.25"
                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all duration-200"
                value={formData.hours}
                onChange={(e) => setFormData(prev => ({ ...prev, hours: e.target.value }))}
                placeholder="Enter hours worked"
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Cost */}
              <div>
                <label htmlFor="cost" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Cost
                </label>
                <div className="mt-1 relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm dark:text-gray-400">$</span>
                  </div>
                  <input
                    type="number"
                    id="cost"
                    required
                    min="0.01"
                    step="0.01"
                    className="pl-7 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all duration-200"
                    value={formData.cost}
                    onChange={(e) => setFormData(prev => ({ ...prev, cost: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Fixed monthly toggle */}
              <div
                onClick={() => setFormData(prev => ({ ...prev, isRecurring: !prev.isRecurring }))}
                className={`flex items-center space-x-3 p-3 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 ${formData.isRecurring ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 dark:border-teal-500' : ''}`}
              >
                <div className={`w-10 h-5 rounded-full relative transition-colors flex-shrink-0 ${formData.isRecurring ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${formData.isRecurring ? 'left-[22px]' : 'left-0.5'}`} />
                </div>
                <div className="flex items-center space-x-2">
                  <RefreshCw className={`w-4 h-4 ${formData.isRecurring ? 'text-teal-600 dark:text-teal-400' : 'text-gray-400'}`} />
                  <div>
                    <span className={`text-sm font-medium ${formData.isRecurring ? 'text-teal-700 dark:text-teal-300' : 'text-gray-700 dark:text-gray-300'}`}>
                      Fixed monthly cost
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Recurring bill (e.g., cloud subscription, hosting)</p>
                  </div>
                </div>
              </div>

              {/* Approval status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Approval Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['pending', 'approved', 'rejected'] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, approvalStatus: s }))}
                      className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                        formData.approvalStatus === s
                          ? approvalStatusConfig[s].color + ' border-current'
                          : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      {approvalStatusConfig[s].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Approved By */}
              <div>
                <label htmlFor="approvedBy" className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <UserCheck className="w-4 h-4 mr-1.5 text-gray-400" />
                  Approved By
                </label>
                <input
                  type="text"
                  id="approvedBy"
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all duration-200"
                  value={formData.approvedBy}
                  onChange={(e) => setFormData(prev => ({ ...prev, approvedBy: e.target.value }))}
                  placeholder="Client contact who approved this purchase"
                />
              </div>

              {/* Vendor & Receipt row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="vendor" className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <Store className="w-4 h-4 mr-1.5 text-gray-400" />
                    Vendor / Store
                  </label>
                  <input
                    type="text"
                    id="vendor"
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all duration-200"
                    value={formData.vendor}
                    onChange={(e) => setFormData(prev => ({ ...prev, vendor: e.target.value }))}
                    placeholder="e.g. Amazon, Best Buy"
                  />
                </div>
                <div>
                  <label htmlFor="receiptRef" className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <Receipt className="w-4 h-4 mr-1.5 text-gray-400" />
                    Receipt / Order Ref
                  </label>
                  <input
                    type="text"
                    id="receiptRef"
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all duration-200"
                    value={formData.receiptRef}
                    onChange={(e) => setFormData(prev => ({ ...prev, receiptRef: e.target.value }))}
                    placeholder="Order # or receipt ref"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Date & Priority */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Date
              </label>
              <input
                type="date"
                id="date"
                required
                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all duration-200"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Priority
              </label>
              <select
                id="priority"
                required
                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all duration-200"
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as 'low' | 'medium' | 'high' }))}
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
            </div>
          </div>

          {/* Status (not for supplies — they auto-complete) */}
          {formData.type !== 'insumos' && (
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Status
              </label>
              <select
                id="status"
                required
                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all duration-200"
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
              >
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Notes (optional)
            </label>
            <textarea
              id="notes"
              rows={3}
              className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all duration-200"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Add any additional notes..."
            />
          </div>

          <div className="flex justify-between pt-6">
            <button
              type="button"
              onClick={() => navigate(returnPath)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-all duration-200"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center px-6 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-all duration-200 transform hover:scale-105"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
