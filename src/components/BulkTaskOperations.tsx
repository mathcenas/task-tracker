import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CheckSquare, Trash2, Edit3, Calendar, X, Check } from 'lucide-react';
import { Task } from '../types';

interface BulkTaskOperationsProps {
  selectedTasks: string[];
  onSelectionChange: (taskIds: string[]) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function BulkTaskOperations({ selectedTasks, onSelectionChange, isOpen, onClose }: BulkTaskOperationsProps) {
  const { tasks, updateTask, deleteTask, getClient } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);
  const [bulkAction, setBulkAction] = useState<'complete' | 'delete' | 'reschedule' | null>(null);
  const [newDate, setNewDate] = useState('');

  if (!isOpen) return null;

  const selectedTaskObjects = tasks.filter(task => selectedTasks.includes(task.id));
  const pendingTasks = selectedTaskObjects.filter(task => !task.finished);

  const handleBulkComplete = async () => {
    setIsProcessing(true);
    
    for (const taskId of selectedTasks) {
      const task = tasks.find(t => t.id === taskId);
      if (task && !task.finished && task.type !== 'insumos') {
        // For bulk completion, we'll set a default 1 hour for service tasks
        updateTask({ ...task, hours: 1, finished: true });
      } else if (task && !task.finished && task.type === 'insumos') {
        updateTask({ ...task, finished: true });
      }
    }
    
    setIsProcessing(false);
    onSelectionChange([]);
    onClose();
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Are you sure you want to delete ${selectedTasks.length} tasks? This action cannot be undone.`)) {
      setIsProcessing(true);
      selectedTasks.forEach(taskId => deleteTask(taskId));
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
        updateTask({ ...task, date: newDate });
      }
    }
    
    setIsProcessing(false);
    onSelectionChange([]);
    onClose();
  };

  const totalEstimatedRevenue = selectedTaskObjects.reduce((sum, task) => {
    if (task.type === 'insumos') return sum + (task.cost || 0);
    const client = getClient(task.clientId);
    return sum + (1 * (client?.hourlyRate || 0)); // Assuming 1 hour for estimation
  }, 0);

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/50 animate-overlayShow" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-contentShow">
        <div className="w-[90vw] max-w-2xl rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
              <CheckSquare className="w-6 h-6 text-blue-500 mr-2" />
              Bulk Operations ({selectedTasks.length} tasks)
            </h3>
            <button
              onClick={onClose}
              className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Summary */}
          <div className="bg-blue-50 p-4 rounded-lg mb-6 dark:bg-blue-900/20">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-sm text-blue-600 font-medium dark:text-blue-400">Selected</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">{selectedTasks.length}</p>
              </div>
              <div>
                <p className="text-sm text-blue-600 font-medium dark:text-blue-400">Pending</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">{pendingTasks.length}</p>
              </div>
              <div>
                <p className="text-sm text-blue-600 font-medium dark:text-blue-400">Est. Revenue</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">${totalEstimatedRevenue.toFixed(0)}</p>
              </div>
              <div>
                <p className="text-sm text-blue-600 font-medium dark:text-blue-400">Types</p>
                <p className="text-sm text-blue-900 dark:text-blue-300">
                  {selectedTaskObjects.filter(t => t.type === 'incident').length}I /
                  {selectedTaskObjects.filter(t => t.type === 'request').length}R /
                  {selectedTaskObjects.filter(t => t.type === 'insumos').length}S
                </p>
              </div>
            </div>
          </div>

          {/* Action Selection */}
          {!bulkAction && (
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-white mb-4">Choose Action:</h4>
              
              {pendingTasks.length > 0 && (
                <button
                  onClick={() => setBulkAction('complete')}
                  className="w-full flex items-center justify-between p-4 border-2 border-green-200 rounded-lg hover:border-green-300 hover:bg-green-50 dark:border-green-800 dark:hover:border-green-700 dark:hover:bg-green-900/20 transition-all"
                >
                  <div className="flex items-center">
                    <Check className="w-5 h-5 text-green-500 mr-3" />
                    <div className="text-left">
                      <p className="font-medium text-gray-900 dark:text-white">Complete Tasks</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Mark {pendingTasks.length} pending tasks as completed</p>
                    </div>
                  </div>
                  <div className="text-green-600 dark:text-green-400 font-medium">
                    ${pendingTasks.reduce((sum, task) => {
                      if (task.type === 'insumos') return sum + (task.cost || 0);
                      const client = getClient(task.clientId);
                      return sum + (1 * (client?.hourlyRate || 0));
                    }, 0).toFixed(0)}
                  </div>
                </button>
              )}

              <button
                onClick={() => setBulkAction('reschedule')}
                className="w-full flex items-center justify-between p-4 border-2 border-blue-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 dark:border-blue-800 dark:hover:border-blue-700 dark:hover:bg-blue-900/20 transition-all"
              >
                <div className="flex items-center">
                  <Calendar className="w-5 h-5 text-blue-500 mr-3" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900 dark:text-white">Reschedule Tasks</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Change date for all selected tasks</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setBulkAction('delete')}
                className="w-full flex items-center justify-between p-4 border-2 border-red-200 rounded-lg hover:border-red-300 hover:bg-red-50 dark:border-red-800 dark:hover:border-red-700 dark:hover:bg-red-900/20 transition-all"
              >
                <div className="flex items-center">
                  <Trash2 className="w-5 h-5 text-red-500 mr-3" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900 dark:text-white">Delete Tasks</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Permanently remove selected tasks</p>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Action Confirmation */}
          {bulkAction === 'complete' && (
            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-lg dark:bg-green-900/20">
                <h4 className="font-medium text-green-900 dark:text-green-300 mb-2">Complete {pendingTasks.length} Tasks</h4>
                <p className="text-sm text-green-700 dark:text-green-400 mb-3">
                  Service tasks will be marked with 1 hour (you can edit individual tasks later for exact hours).
                  Supply tasks will be marked as completed.
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={handleBulkComplete}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {isProcessing ? 'Processing...' : 'Complete Tasks'}
                  </button>
                  <button
                    onClick={() => setBulkAction(null)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {bulkAction === 'reschedule' && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg dark:bg-blue-900/20">
                <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-3">Reschedule Tasks</h4>
                <div className="mb-4">
                  <label htmlFor="newDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    New Date
                  </label>
                  <input
                    type="date"
                    id="newDate"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={handleBulkReschedule}
                    disabled={isProcessing || !newDate}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {isProcessing ? 'Processing...' : 'Reschedule Tasks'}
                  </button>
                  <button
                    onClick={() => setBulkAction(null)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {bulkAction === 'delete' && (
            <div className="space-y-4">
              <div className="bg-red-50 p-4 rounded-lg dark:bg-red-900/20">
                <h4 className="font-medium text-red-900 dark:text-red-300 mb-2">⚠️ Delete {selectedTasks.length} Tasks</h4>
                <p className="text-sm text-red-700 dark:text-red-400 mb-3">
                  This action cannot be undone. All selected tasks will be permanently removed.
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={handleBulkDelete}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {isProcessing ? 'Deleting...' : 'Delete Tasks'}
                  </button>
                  <button
                    onClick={() => setBulkAction(null)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}