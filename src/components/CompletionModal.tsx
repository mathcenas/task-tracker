import React, { useState } from 'react';
import { X, Clock, CheckCircle } from 'lucide-react';

interface CompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (hours: number, accepted?: boolean) => void;
  taskType: string;
  taskDescription?: string;
  isRecurring?: boolean;
  isAccepted?: boolean;
}

export function CompletionModal({ isOpen, onClose, onComplete, taskType, taskDescription, isRecurring, isAccepted }: CompletionModalProps) {
  const [hours, setHours] = useState('');
  const [accepted, setAccepted] = useState(isAccepted || false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // For recurring tasks, require acceptance
    if (isRecurring && !accepted) {
      alert('Please accept the recurring task before completing it.');
      return;
    }

    onComplete(taskType === 'insumos' ? 0 : Number(hours), accepted);
    setHours('');
    setAccepted(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 animate-overlayShow dark:bg-black/70" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-contentShow">
        <div className="w-[90vw] max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center">
              <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
              Complete Task
            </h3>
            <button
              onClick={onClose}
              className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {taskDescription && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg dark:bg-gray-700">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">TASK DESCRIPTION</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">{taskDescription}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {taskType !== 'insumos' && (
              <div>
                <label htmlFor="hours" className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  Hours Worked
                </label>
                <input
                  type="number"
                  id="hours"
                  required
                  min="0.25"
                  step="0.25"
                  className="mt-1 block w-full rounded-lg border-gray-300 bg-white shadow-sm 
                           focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 
                           dark:bg-gray-700 dark:text-white transition-all duration-200"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  How many hours did this task take to complete?
                </p>
              </div>
            )}

            {isRecurring && !isAccepted && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-900/20 dark:border-yellow-800">
                <div className="flex items-start">
                  <input
                    type="checkbox"
                    id="acceptRecurring"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="acceptRecurring" className="ml-2 text-sm text-yellow-800 dark:text-yellow-300">
                    <span className="font-semibold">Accept this recurring task</span>
                    <p className="mt-1 text-xs">This task was auto-generated. Please verify the hours and accept it before marking as complete.</p>
                  </label>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm 
                         font-medium text-gray-700 bg-white hover:bg-gray-50
                         dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 
                         dark:hover:bg-gray-600 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm 
                         font-medium text-white bg-blue-600 hover:bg-blue-700
                         dark:bg-blue-500 dark:hover:bg-blue-600 transition-all duration-200
                         transform hover:scale-105"
              >
                {taskType === 'insumos' ? 'Mark Complete' : 'Complete Task'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}