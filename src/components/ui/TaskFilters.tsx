import React from 'react';
import { Filter } from 'lucide-react';

interface TaskFiltersProps {
  taskFilter: 'all' | 'overdue' | 'today' | 'upcoming' | 'completed';
  priorityFilter: 'all' | 'high' | 'medium' | 'low';
  typeFilter: 'all' | 'incident' | 'request' | 'insumos';
  onTaskFilterChange: (filter: 'all' | 'overdue' | 'today' | 'upcoming' | 'completed') => void;
  onPriorityFilterChange: (filter: 'all' | 'high' | 'medium' | 'low') => void;
  onTypeFilterChange: (filter: 'all' | 'incident' | 'request' | 'insumos') => void;
  onClearFilters: () => void;
  counts: {
    allPending: number;
    overdue: number;
    today: number;
    upcoming: number;
    completed: number;
  };
  filteredCount: number;
  showCompletedFilter?: boolean;
}

export function TaskFilters({
  taskFilter,
  priorityFilter,
  typeFilter,
  onTaskFilterChange,
  onPriorityFilterChange,
  onTypeFilterChange,
  onClearFilters,
  counts,
  filteredCount,
  showCompletedFilter = true
}: TaskFiltersProps) {
  return (
    <div className="bg-white rounded-md border border-gray-200 dark:border-gray-700 p-6 dark:bg-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <Filter className="w-5 h-5 text-blue-500 mr-2" />
          Filter Tasks
        </h3>
        <button
          onClick={onClearFilters}
          className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
        >
          Clear Filters
        </button>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Status
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onTaskFilterChange('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              taskFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            All Pending ({counts.allPending})
          </button>
          <button
            onClick={() => onTaskFilterChange('overdue')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              taskFilter === 'overdue'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Overdue ({counts.overdue})
          </button>
          <button
            onClick={() => onTaskFilterChange('today')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              taskFilter === 'today'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Today ({counts.today})
          </button>
          <button
            onClick={() => onTaskFilterChange('upcoming')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              taskFilter === 'upcoming'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Upcoming ({counts.upcoming})
          </button>
          {showCompletedFilter && (
            <button
              onClick={() => onTaskFilterChange('completed')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                taskFilter === 'completed'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              Completed ({counts.completed})
            </button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Priority
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onPriorityFilterChange('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              priorityFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            All
          </button>
          <button
            onClick={() => onPriorityFilterChange('high')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              priorityFilter === 'high'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            High Priority
          </button>
          <button
            onClick={() => onPriorityFilterChange('medium')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              priorityFilter === 'medium'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Medium Priority
          </button>
          <button
            onClick={() => onPriorityFilterChange('low')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              priorityFilter === 'low'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Low Priority
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Type
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onTypeFilterChange('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              typeFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            All Types
          </button>
          <button
            onClick={() => onTypeFilterChange('incident')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              typeFilter === 'incident'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Incident
          </button>
          <button
            onClick={() => onTypeFilterChange('request')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              typeFilter === 'request'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Request
          </button>
          <button
            onClick={() => onTypeFilterChange('insumos')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              typeFilter === 'insumos'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Supplies
          </button>
        </div>
      </div>

      {(taskFilter !== 'all' || priorityFilter !== 'all' || typeFilter !== 'all') && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg dark:bg-blue-900/20">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Showing {filteredCount} task{filteredCount !== 1 ? 's' : ''}</strong>
            {taskFilter !== 'all' && ` • Status: ${taskFilter}`}
            {priorityFilter !== 'all' && ` • Priority: ${priorityFilter}`}
            {typeFilter !== 'all' && ` • Type: ${typeFilter}`}
          </p>
        </div>
      )}
    </div>
  );
}
