import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { CheckSquare, Trash2, Calendar, X, Check, Save, Users, Folders, Clock, Tag, AlertTriangle } from 'lucide-react';

interface BulkTaskOperationsProps {
  selectedTasks: string[];
  onSelectionChange: (taskIds: string[]) => void;
  isOpen: boolean;
  onClose: () => void;
}

type BulkAction = 'edit' | 'complete' | 'delete' | null;

interface BulkEditFields {
  clientId: string;
  projectId: string;
  date: string;
  hours: string;
  status: string;
  priority: string;
  type: string;
}

const UNCHANGED = '__unchanged__';

export function BulkTaskOperations({ selectedTasks, onSelectionChange, isOpen, onClose }: BulkTaskOperationsProps) {
  const { tasks, updateTask, deleteTask, getClient, clients, projects } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);
  const [bulkAction, setBulkAction] = useState<BulkAction>(null);
  const [editFields, setEditFields] = useState<BulkEditFields>({
    clientId: UNCHANGED,
    projectId: UNCHANGED,
    date: '',
    hours: '',
    status: UNCHANGED,
    priority: UNCHANGED,
    type: UNCHANGED,
  });

  const selectedTaskObjects = useMemo(
    () => tasks.filter(task => selectedTasks.includes(task.id)),
    [tasks, selectedTasks]
  );
  const pendingTasks = selectedTaskObjects.filter(task => !task.finished);

  const availableProjects = useMemo(() => {
    if (editFields.clientId === UNCHANGED) return projects;
    return projects.filter(p => p.clientId === editFields.clientId);
  }, [projects, editFields.clientId]);

  const resetAndClose = () => {
    setBulkAction(null);
    setEditFields({
      clientId: UNCHANGED,
      projectId: UNCHANGED,
      date: '',
      hours: '',
      status: UNCHANGED,
      priority: UNCHANGED,
      type: UNCHANGED,
    });
    onSelectionChange([]);
    onClose();
  };

  const changedFieldCount = useMemo(() => {
    let count = 0;
    if (editFields.clientId !== UNCHANGED) count++;
    if (editFields.projectId !== UNCHANGED) count++;
    if (editFields.date) count++;
    if (editFields.hours) count++;
    if (editFields.status !== UNCHANGED) count++;
    if (editFields.priority !== UNCHANGED) count++;
    if (editFields.type !== UNCHANGED) count++;
    return count;
  }, [editFields]);

  const handleBulkEdit = async () => {
    if (changedFieldCount === 0) return;

    const summary: string[] = [];
    if (editFields.clientId !== UNCHANGED) {
      const c = clients.find(cl => cl.id === editFields.clientId);
      summary.push(`Client -> ${c?.name}`);
    }
    if (editFields.projectId !== UNCHANGED) {
      const p = projects.find(pr => pr.id === editFields.projectId);
      summary.push(`Project -> ${p?.name}`);
    }
    if (editFields.date) summary.push(`Date -> ${editFields.date}`);
    if (editFields.hours) summary.push(`Hours -> ${editFields.hours}`);
    if (editFields.status !== UNCHANGED) summary.push(`Status -> ${editFields.status}`);
    if (editFields.priority !== UNCHANGED) summary.push(`Priority -> ${editFields.priority}`);
    if (editFields.type !== UNCHANGED) summary.push(`Type -> ${editFields.type}`);

    if (!window.confirm(
      `Apply these changes to ${selectedTasks.length} tasks?\n\n${summary.join('\n')}`
    )) return;

    setIsProcessing(true);

    for (const taskId of selectedTasks) {
      const task = tasks.find(t => t.id === taskId);
      if (!task) continue;

      const updated = { ...task };

      if (editFields.clientId !== UNCHANGED) updated.clientId = editFields.clientId;
      if (editFields.projectId !== UNCHANGED) updated.projectId = editFields.projectId;
      if (editFields.date) updated.date = editFields.date;
      if (editFields.hours) {
        updated.hours = Number(editFields.hours);
        updated.finished = true;
        updated.status = 'completed';
        if (!updated.completedAt) updated.completedAt = new Date().toISOString();
      }
      if (editFields.status !== UNCHANGED) {
        updated.status = editFields.status as any;
        if (editFields.status === 'completed') {
          updated.finished = true;
          if (!updated.completedAt) updated.completedAt = new Date().toISOString();
        }
      }
      if (editFields.priority !== UNCHANGED) updated.priority = editFields.priority as any;
      if (editFields.type !== UNCHANGED) updated.type = editFields.type as any;

      try {
        await updateTask(updated);
      } catch (err) {
        console.error(`Failed to update task ${taskId}:`, err);
      }
    }

    setIsProcessing(false);
    resetAndClose();
  };

  const handleBulkComplete = async () => {
    setIsProcessing(true);
    for (const taskId of selectedTasks) {
      const task = tasks.find(t => t.id === taskId);
      if (task && !task.finished) {
        if (task.type === 'insumos') {
          await updateTask({ ...task, finished: true, status: 'completed', completedAt: new Date().toISOString() });
        } else {
          await updateTask({ ...task, hours: task.hours || 1, finished: true, status: 'completed', completedAt: new Date().toISOString() });
        }
      }
    }
    setIsProcessing(false);
    resetAndClose();
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedTasks.length} tasks? This cannot be undone.`)) return;
    setIsProcessing(true);
    for (const taskId of selectedTasks) {
      await deleteTask(taskId);
    }
    setIsProcessing(false);
    resetAndClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/50" onClick={resetAndClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <CheckSquare className="w-5 h-5 text-blue-500 mr-2" />
              Bulk Operations ({selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''})
            </h3>
            <button onClick={resetAndClose} className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Summary strip */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mb-5 grid grid-cols-4 gap-3 text-center text-sm">
            <div>
              <div className="text-blue-600 dark:text-blue-400 font-medium">Selected</div>
              <div className="text-lg font-bold text-blue-900 dark:text-blue-200">{selectedTasks.length}</div>
            </div>
            <div>
              <div className="text-blue-600 dark:text-blue-400 font-medium">Pending</div>
              <div className="text-lg font-bold text-blue-900 dark:text-blue-200">{pendingTasks.length}</div>
            </div>
            <div>
              <div className="text-blue-600 dark:text-blue-400 font-medium">Completed</div>
              <div className="text-lg font-bold text-blue-900 dark:text-blue-200">{selectedTasks.length - pendingTasks.length}</div>
            </div>
            <div>
              <div className="text-blue-600 dark:text-blue-400 font-medium">Types</div>
              <div className="text-sm font-bold text-blue-900 dark:text-blue-200">
                {selectedTaskObjects.filter(t => t.type === 'incident').length}I / {selectedTaskObjects.filter(t => t.type === 'request').length}R / {selectedTaskObjects.filter(t => t.type === 'insumos').length}S
              </div>
            </div>
          </div>

          {/* Action chooser */}
          {!bulkAction && (
            <div className="space-y-2">
              <button
                onClick={() => setBulkAction('edit')}
                className="w-full flex items-center p-4 border-2 border-blue-200 dark:border-blue-800 rounded-lg hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
              >
                <Save className="w-5 h-5 text-blue-500 mr-3" />
                <div className="text-left">
                  <p className="font-medium text-gray-900 dark:text-white">Bulk Edit</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Change client, project, hours, status, priority, type, or date</p>
                </div>
              </button>

              {pendingTasks.length > 0 && (
                <button
                  onClick={() => setBulkAction('complete')}
                  className="w-full flex items-center p-4 border-2 border-green-200 dark:border-green-800 rounded-lg hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all"
                >
                  <Check className="w-5 h-5 text-green-500 mr-3" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900 dark:text-white">Quick Complete</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Mark {pendingTasks.length} pending tasks as completed (1h default for service tasks)</p>
                  </div>
                </button>
              )}

              <button
                onClick={() => setBulkAction('delete')}
                className="w-full flex items-center p-4 border-2 border-red-200 dark:border-red-800 rounded-lg hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
              >
                <Trash2 className="w-5 h-5 text-red-500 mr-3" />
                <div className="text-left">
                  <p className="font-medium text-gray-900 dark:text-white">Delete Tasks</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Permanently remove {selectedTasks.length} tasks</p>
                </div>
              </button>
            </div>
          )}

          {/* BULK EDIT */}
          {bulkAction === 'edit' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900 dark:text-white">Edit Fields</h4>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Only changed fields will be applied. Leave as "No change" to skip.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Client */}
                <div>
                  <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <Users className="w-3.5 h-3.5 mr-1.5" />
                    Client
                  </label>
                  <select
                    value={editFields.clientId}
                    onChange={(e) => setEditFields(prev => ({
                      ...prev,
                      clientId: e.target.value,
                      projectId: e.target.value === UNCHANGED ? prev.projectId : UNCHANGED
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                  >
                    <option value={UNCHANGED}>-- No change --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Project */}
                <div>
                  <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <Folders className="w-3.5 h-3.5 mr-1.5" />
                    Project
                  </label>
                  <select
                    value={editFields.projectId}
                    onChange={(e) => setEditFields(prev => ({ ...prev, projectId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                  >
                    <option value={UNCHANGED}>-- No change --</option>
                    {availableProjects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <Tag className="w-3.5 h-3.5 mr-1.5" />
                    Status
                  </label>
                  <select
                    value={editFields.status}
                    onChange={(e) => setEditFields(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                  >
                    <option value={UNCHANGED}>-- No change --</option>
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                    Priority
                  </label>
                  <select
                    value={editFields.priority}
                    onChange={(e) => setEditFields(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                  >
                    <option value={UNCHANGED}>-- No change --</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                {/* Type */}
                <div>
                  <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <Tag className="w-3.5 h-3.5 mr-1.5" />
                    Type
                  </label>
                  <select
                    value={editFields.type}
                    onChange={(e) => setEditFields(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                  >
                    <option value={UNCHANGED}>-- No change --</option>
                    <option value="incident">Incident</option>
                    <option value="request">Request</option>
                    <option value="insumos">Supplies</option>
                  </select>
                </div>

                {/* Hours */}
                <div>
                  <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <Clock className="w-3.5 h-3.5 mr-1.5" />
                    Hours
                  </label>
                  <input
                    type="number"
                    min="0.25"
                    step="0.25"
                    placeholder="No change"
                    value={editFields.hours}
                    onChange={(e) => setEditFields(prev => ({ ...prev, hours: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                  />
                  {editFields.hours && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Setting hours will also mark tasks as completed
                    </p>
                  )}
                </div>

                {/* Date -- full width */}
                <div className="md:col-span-2">
                  <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <Calendar className="w-3.5 h-3.5 mr-1.5" />
                    Date
                  </label>
                  <input
                    type="date"
                    value={editFields.date}
                    onChange={(e) => setEditFields(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setBulkAction(null)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors"
                >
                  Back
                </button>
                <div className="flex items-center space-x-3">
                  {changedFieldCount > 0 && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {changedFieldCount} field{changedFieldCount !== 1 ? 's' : ''} to apply
                    </span>
                  )}
                  <button
                    onClick={handleBulkEdit}
                    disabled={isProcessing || changedFieldCount === 0}
                    className="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isProcessing ? 'Applying...' : `Apply to ${selectedTasks.length} Tasks`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* QUICK COMPLETE */}
          {bulkAction === 'complete' && (
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg space-y-3">
              <h4 className="font-medium text-green-900 dark:text-green-300">Complete {pendingTasks.length} Tasks</h4>
              <p className="text-sm text-green-700 dark:text-green-400">
                Service tasks without hours will get 1h default. Supply tasks will be marked as completed. Tasks already completed will be skipped.
              </p>
              <div className="flex space-x-3 pt-2">
                <button
                  onClick={handleBulkComplete}
                  disabled={isProcessing}
                  className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {isProcessing ? 'Processing...' : 'Complete Tasks'}
                </button>
                <button
                  onClick={() => setBulkAction(null)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {/* DELETE */}
          {bulkAction === 'delete' && (
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg space-y-3">
              <h4 className="font-medium text-red-900 dark:text-red-300">Delete {selectedTasks.length} Tasks</h4>
              <p className="text-sm text-red-700 dark:text-red-400">
                This action cannot be undone. All selected tasks will be permanently removed.
              </p>
              <div className="flex space-x-3 pt-2">
                <button
                  onClick={handleBulkDelete}
                  disabled={isProcessing}
                  className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {isProcessing ? 'Deleting...' : 'Delete Tasks'}
                </button>
                <button
                  onClick={() => setBulkAction(null)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
