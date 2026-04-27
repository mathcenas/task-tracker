import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CheckSquare, Trash2, Calendar, X, Check, CreditCard as Edit3 } from 'lucide-react';

interface BulkTaskOperationsProps {
  selectedTasks: string[];
  onSelectionChange: (taskIds: string[]) => void;
  isOpen: boolean;
  onClose: () => void;
}

const UNCHANGED = '__unchanged__';

export function BulkTaskOperations({ selectedTasks, onSelectionChange, isOpen, onClose }: BulkTaskOperationsProps) {
  const { tasks, updateTask, deleteTask, clients, projects } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);
  const [bulkAction, setBulkAction] = useState<'complete' | 'delete' | 'reschedule' | 'edit' | null>(null);
  const [newDate, setNewDate] = useState('');

  // Edit fields — UNCHANGED means "don't touch this field"
  const [editClientId, setEditClientId] = useState(UNCHANGED);
  const [editProjectId, setEditProjectId] = useState(UNCHANGED);
  const [editStatus, setEditStatus] = useState(UNCHANGED);
  const [editPriority, setEditPriority] = useState(UNCHANGED);
  const [editType, setEditType] = useState(UNCHANGED);
  const [editHours, setEditHours] = useState('');

  if (!isOpen) return null;

  const selectedTaskObjects = tasks.filter(task => selectedTasks.includes(task.id));
  const pendingTasks = selectedTaskObjects.filter(task => !task.finished);

  const availableProjects = editClientId !== UNCHANGED && editClientId !== ''
    ? projects.filter(p => p.clientId === editClientId)
    : projects;

  const handleBulkComplete = async () => {
    setIsProcessing(true);
    for (const taskId of selectedTasks) {
      const task = tasks.find(t => t.id === taskId);
      if (task && !task.finished) {
        if (task.type === 'insumos') {
          await updateTask({ ...task, finished: true, status: 'completed', completedAt: new Date().toISOString() });
        } else {
          await updateTask({ ...task, hours: 1, finished: true, status: 'completed', completedAt: new Date().toISOString() });
        }
      }
    }
    setIsProcessing(false);
    onSelectionChange([]);
    onClose();
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Delete ${selectedTasks.length} tasks? This cannot be undone.`)) {
      setIsProcessing(true);
      for (const taskId of selectedTasks) {
        await deleteTask(taskId);
      }
      setIsProcessing(false);
      onSelectionChange([]);
      onClose();
    }
  };

  const handleBulkReschedule = async () => {
    if (!newDate) return;
    setIsProcessing(true);
    for (const taskId of selectedTasks) {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        await updateTask({ ...task, date: newDate });
      }
    }
    setIsProcessing(false);
    onSelectionChange([]);
    onClose();
  };

  const handleBulkEdit = async () => {
    setIsProcessing(true);
    for (const taskId of selectedTasks) {
      const task = tasks.find(t => t.id === taskId);
      if (!task) continue;

      const patch: Record<string, any> = {};
      if (editClientId !== UNCHANGED) patch.clientId = editClientId;
      if (editProjectId !== UNCHANGED) patch.projectId = editProjectId;
      if (editStatus !== UNCHANGED) patch.status = editStatus;
      if (editPriority !== UNCHANGED) patch.priority = editPriority;
      if (editType !== UNCHANGED) patch.type = editType;
      if (editHours !== '') patch.hours = parseFloat(editHours);

      if (Object.keys(patch).length > 0) {
        await updateTask({ ...task, ...patch });
      }
    }
    setIsProcessing(false);
    onSelectionChange([]);
    onClose();
  };

  const hasEditChanges =
    editClientId !== UNCHANGED ||
    editProjectId !== UNCHANGED ||
    editStatus !== UNCHANGED ||
    editPriority !== UNCHANGED ||
    editType !== UNCHANGED ||
    editHours !== '';

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-2xl">
        <div className="rounded-xl bg-white dark:bg-gray-800 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-blue-500" />
              Bulk Operations
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                — {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''} selected
              </span>
            </h3>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Summary bar */}
          <div className="grid grid-cols-4 gap-px bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
            {[
              { label: 'Selected', value: selectedTasks.length },
              { label: 'Pending', value: pendingTasks.length },
              { label: 'Incidents', value: selectedTaskObjects.filter(t => t.type === 'incident').length },
              { label: 'Supplies', value: selectedTaskObjects.filter(t => t.type === 'insumos').length },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white dark:bg-gray-800 px-4 py-3 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
              </div>
            ))}
          </div>

          <div className="p-6">
            {/* Action selection */}
            {!bulkAction && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Choose an action:</p>

                <button
                  onClick={() => setBulkAction('edit')}
                  className="w-full flex items-center gap-3 p-4 border-2 border-blue-200 dark:border-blue-800 rounded-lg hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-left"
                >
                  <Edit3 className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Edit Fields</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Change client, project, status, priority, type, or hours on all selected tasks
                    </p>
                  </div>
                </button>

                {pendingTasks.length > 0 && (
                  <button
                    onClick={() => setBulkAction('complete')}
                    className="w-full flex items-center gap-3 p-4 border-2 border-green-200 dark:border-green-800 rounded-lg hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all text-left"
                  >
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Quick Complete</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Mark {pendingTasks.length} pending task{pendingTasks.length !== 1 ? 's' : ''} as completed (service tasks get 1h default)
                      </p>
                    </div>
                  </button>
                )}

                <button
                  onClick={() => setBulkAction('reschedule')}
                  className="w-full flex items-center gap-3 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all text-left"
                >
                  <Calendar className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Reschedule</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Move all selected tasks to a new date</p>
                  </div>
                </button>

                <button
                  onClick={() => setBulkAction('delete')}
                  className="w-full flex items-center gap-3 p-4 border-2 border-red-200 dark:border-red-800 rounded-lg hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all text-left"
                >
                  <Trash2 className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Delete Tasks</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Permanently remove all selected tasks</p>
                  </div>
                </button>
              </div>
            )}

            {/* Edit fields panel */}
            {bulkAction === 'edit' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Leave any field as "No change" to keep existing values.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Client</label>
                    <select
                      value={editClientId}
                      onChange={(e) => { setEditClientId(e.target.value); setEditProjectId(UNCHANGED); }}
                      className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value={UNCHANGED}>No change</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project</label>
                    <select
                      value={editProjectId}
                      onChange={(e) => setEditProjectId(e.target.value)}
                      className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:ring-blue-500 focus:border-blue-500"
                      disabled={editClientId === UNCHANGED}
                    >
                      <option value={UNCHANGED}>No change</option>
                      {availableProjects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value={UNCHANGED}>No change</option>
                      <option value="not_started">Not Started</option>
                      <option value="in_progress">In Progress</option>
                      <option value="review">Review</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                    <select
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value)}
                      className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value={UNCHANGED}>No change</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value)}
                      className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value={UNCHANGED}>No change</option>
                      <option value="incident">Incident</option>
                      <option value="request">Request</option>
                      <option value="insumos">Supply</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hours (service tasks)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="No change"
                      value={editHours}
                      onChange={(e) => setEditHours(e.target.value)}
                      className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleBulkEdit}
                    disabled={isProcessing || !hasEditChanges}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {isProcessing ? 'Applying...' : `Apply to ${selectedTasks.length} task${selectedTasks.length !== 1 ? 's' : ''}`}
                  </button>
                  <button
                    onClick={() => setBulkAction(null)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}

            {/* Quick complete */}
            {bulkAction === 'complete' && (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg space-y-3">
                <p className="font-medium text-green-900 dark:text-green-300">
                  Complete {pendingTasks.length} pending task{pendingTasks.length !== 1 ? 's' : ''}
                </p>
                <p className="text-sm text-green-700 dark:text-green-400">
                  Service tasks will be logged with 1 hour — edit individual tasks afterwards for exact hours.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleBulkComplete}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {isProcessing ? 'Processing...' : 'Complete Tasks'}
                  </button>
                  <button onClick={() => setBulkAction(null)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300">
                    Back
                  </button>
                </div>
              </div>
            )}

            {/* Reschedule */}
            {bulkAction === 'reschedule' && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="newDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    New Date for all {selectedTasks.length} tasks
                  </label>
                  <input
                    type="date"
                    id="newDate"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="block w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleBulkReschedule}
                    disabled={isProcessing || !newDate}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {isProcessing ? 'Processing...' : 'Reschedule Tasks'}
                  </button>
                  <button onClick={() => setBulkAction(null)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300">
                    Back
                  </button>
                </div>
              </div>
            )}

            {/* Delete */}
            {bulkAction === 'delete' && (
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg space-y-3">
                <p className="font-medium text-red-900 dark:text-red-300">
                  Delete {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''}?
                </p>
                <p className="text-sm text-red-700 dark:text-red-400">This cannot be undone.</p>
                <div className="flex gap-3">
                  <button
                    onClick={handleBulkDelete}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {isProcessing ? 'Deleting...' : 'Delete Tasks'}
                  </button>
                  <button onClick={() => setBulkAction(null)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300">
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
