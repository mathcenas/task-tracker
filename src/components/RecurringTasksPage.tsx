import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Repeat, Plus, Trash2, Calendar, AlertTriangle, Edit2, CheckCircle, XCircle, Save, X } from 'lucide-react';
import { format, addMonths, isBefore } from 'date-fns';
import { apiService } from '../services/api';

interface RecurringTask {
  id: string;
  name: string;
  description: string;
  type: 'incident' | 'request' | 'insumos';
  priority: 'low' | 'medium' | 'high';
  clientId: string;
  projectId: string;
  dayOfMonth: number;
  estimatedHours?: number;
  estimatedCost?: number;
  isActive: boolean;
  lastGenerated?: string;
  nextDue: string;
  recurringStartDate?: string;
  recurringWeekend?: boolean;
  recurringWeekendType?: 'first' | 'second' | 'third' | 'fourth' | 'last';
  recurringWeekendDay?: 'saturday' | 'sunday';
  recurringEndDate?: string;
}

export function RecurringTasksPage() {
  const { clients, projects, getClient, getProject } = useApp();
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterActive, setFilterActive] = useState<boolean | 'all'>('all');
  const [editingTask, setEditingTask] = useState<RecurringTask | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showPastDateWarning, setShowPastDateWarning] = useState(false);
  const [nextOccurrence, setNextOccurrence] = useState<string>('');

  const [newTask, setNewTask] = useState<Partial<RecurringTask>>({
    name: '',
    description: '',
    type: 'request',
    priority: 'medium',
    clientId: '',
    projectId: '',
    dayOfMonth: 1,
    isActive: true,
    recurringWeekend: false,
    recurringWeekendType: 'first',
    recurringWeekendDay: 'saturday',
    recurringStartDate: '',
    recurringEndDate: ''
  });

  useEffect(() => {
    loadRecurringTasks();
  }, []);

  const loadRecurringTasks = async () => {
    try {
      const tasks = await apiService.getRecurringTasks();
      setRecurringTasks(tasks);
    } catch (error) {
      console.error('Error loading recurring tasks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateNextOccurrence = (dayOfMonth: number, startDate?: string, weekend?: boolean, weekendType?: string, weekendDay?: string) => {
    const today = new Date();
    let baseDate = startDate ? new Date(startDate) : today;

    if (startDate && isBefore(today, baseDate)) {
      baseDate = new Date(startDate);
    } else {
      baseDate = today;
    }

    if (weekend && weekendType && weekendDay) {
      const targetDay = weekendDay === 'saturday' ? 6 : 0;
      const year = baseDate.getFullYear();
      const month = baseDate.getMonth();
      const lastDay = new Date(year, month + 1, 0);

      const weekends = [];
      for (let date = 1; date <= lastDay.getDate(); date++) {
        const currentDate = new Date(year, month, date);
        if (currentDate.getDay() === targetDay) {
          weekends.push(date);
        }
      }

      let targetDate;
      switch (weekendType) {
        case 'first': targetDate = weekends[0]; break;
        case 'second': targetDate = weekends[1]; break;
        case 'third': targetDate = weekends[2]; break;
        case 'fourth': targetDate = weekends[3]; break;
        case 'last': targetDate = weekends[weekends.length - 1]; break;
        default: targetDate = weekends[0];
      }

      if (targetDate) {
        const nextDate = new Date(year, month, targetDate);
        if (nextDate < today) {
          return calculateNextOccurrence(dayOfMonth, format(addMonths(baseDate, 1), 'yyyy-MM-dd'), weekend, weekendType, weekendDay);
        }
        return format(nextDate, 'MMM d, yyyy');
      }
    }

    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const targetDay = Math.min(dayOfMonth, new Date(year, month + 1, 0).getDate());
    const nextDate = new Date(year, month, targetDay);

    if (nextDate < today) {
      const nextMonth = addMonths(baseDate, 1);
      const nextMonthDay = Math.min(dayOfMonth, new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate());
      return format(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), nextMonthDay), 'MMM d, yyyy');
    }

    return format(nextDate, 'MMM d, yyyy');
  };

  useEffect(() => {
    const task = editingTask || (isCreating ? newTask : null);
    if (task && task.dayOfMonth) {
      const next = calculateNextOccurrence(
        task.dayOfMonth,
        task.recurringStartDate,
        task.recurringWeekend,
        task.recurringWeekendType,
        task.recurringWeekendDay
      );
      setNextOccurrence(next);

      if (task.recurringStartDate) {
        const startDate = new Date(task.recurringStartDate);
        const today = new Date();
        setShowPastDateWarning(isBefore(startDate, today));
      } else {
        setShowPastDateWarning(false);
      }
    }
  }, [
    editingTask?.dayOfMonth,
    editingTask?.recurringStartDate,
    editingTask?.recurringWeekend,
    editingTask?.recurringWeekendType,
    editingTask?.recurringWeekendDay,
    newTask.dayOfMonth,
    newTask.recurringStartDate,
    newTask.recurringWeekend,
    newTask.recurringWeekendType,
    newTask.recurringWeekendDay,
    isCreating
  ]);

  const handleSaveNew = async () => {
    if (!newTask.name || !newTask.clientId || !newTask.projectId) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const nextDue = calculateNextDueDate(newTask.dayOfMonth!, newTask.recurringStartDate, newTask.recurringWeekend, newTask.recurringWeekendType, newTask.recurringWeekendDay);
      await apiService.createRecurringTask({ ...newTask, nextDue } as RecurringTask);
      await loadRecurringTasks();
      setIsCreating(false);
      setNewTask({
        name: '',
        description: '',
        type: 'request',
        priority: 'medium',
        clientId: '',
        projectId: '',
        dayOfMonth: 1,
        isActive: true,
        recurringWeekend: false,
        recurringWeekendType: 'first',
        recurringWeekendDay: 'saturday',
        recurringStartDate: '',
        recurringEndDate: ''
      });
    } catch (error) {
      console.error('Error creating recurring task:', error);
      alert('Failed to create recurring task');
    }
  };

  const calculateNextDueDate = (dayOfMonth: number, startDate?: string, weekend?: boolean, weekendType?: string, weekendDay?: string): string => {
    const today = new Date();
    let baseDate = startDate ? new Date(startDate) : today;

    if (startDate && isBefore(today, baseDate)) {
      baseDate = new Date(startDate);
    } else {
      baseDate = today;
    }

    if (weekend && weekendType && weekendDay) {
      const targetDay = weekendDay === 'saturday' ? 6 : 0;
      const year = baseDate.getFullYear();
      const month = baseDate.getMonth();
      const lastDay = new Date(year, month + 1, 0);

      const weekends = [];
      for (let date = 1; date <= lastDay.getDate(); date++) {
        const currentDate = new Date(year, month, date);
        if (currentDate.getDay() === targetDay) {
          weekends.push(date);
        }
      }

      let targetDate;
      switch (weekendType) {
        case 'first': targetDate = weekends[0]; break;
        case 'second': targetDate = weekends[1]; break;
        case 'third': targetDate = weekends[2]; break;
        case 'fourth': targetDate = weekends[3]; break;
        case 'last': targetDate = weekends[weekends.length - 1]; break;
        default: targetDate = weekends[0];
      }

      if (targetDate) {
        const nextDate = new Date(year, month, targetDate);
        if (nextDate < today) {
          return calculateNextDueDate(dayOfMonth, format(addMonths(baseDate, 1), 'yyyy-MM-dd'), weekend, weekendType, weekendDay);
        }
        return format(nextDate, 'yyyy-MM-dd');
      }
    }

    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const targetDay = Math.min(dayOfMonth, new Date(year, month + 1, 0).getDate());
    const nextDate = new Date(year, month, targetDay);

    if (nextDate < today) {
      const nextMonth = addMonths(baseDate, 1);
      const nextMonthDay = Math.min(dayOfMonth, new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate());
      return format(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), nextMonthDay), 'yyyy-MM-dd');
    }

    return format(nextDate, 'yyyy-MM-dd');
  };

  const handleUpdate = async (taskId: string) => {
    if (!editingTask) return;

    try {
      await apiService.updateRecurringTask(taskId, editingTask);
      await loadRecurringTasks();
      setEditingTask(null);
    } catch (error) {
      console.error('Error updating recurring task:', error);
      alert('Failed to update recurring task');
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this recurring task?')) return;

    try {
      await apiService.deleteRecurringTask(taskId);
      await loadRecurringTasks();
    } catch (error) {
      console.error('Error deleting recurring task:', error);
      alert('Failed to delete recurring task');
    }
  };

  const filteredTasks = recurringTasks.filter(task => {
    if (filterClient !== 'all' && task.clientId !== filterClient) return false;
    if (filterType !== 'all' && task.type !== filterType) return false;
    if (filterActive !== 'all' && task.isActive !== filterActive) return false;
    return true;
  });

  const clientProjects = editingTask ? projects.filter(p => p.clientId === editingTask.clientId) : [];
  const newTaskProjects = isCreating ? projects.filter(p => p.clientId === newTask.clientId) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center">
            <Repeat className="w-8 h-8 mr-3 text-purple-600 dark:text-purple-400" />
            Recurring Tasks
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage tasks that repeat automatically every month
          </p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Recurring Task
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Client
            </label>
            <select
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="all">All Clients</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Type
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="all">All Types</option>
              <option value="incident">Incident</option>
              <option value="request">Request</option>
              <option value="insumos">Supplies</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <select
              value={filterActive === 'all' ? 'all' : filterActive ? 'active' : 'inactive'}
              onChange={(e) => setFilterActive(e.target.value === 'all' ? 'all' : e.target.value === 'active')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="all">All</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Create New Form */}
      {isCreating && (
        <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create New Recurring Task</h2>
            <button onClick={() => setIsCreating(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              <X className="w-5 h-5" />
            </button>
          </div>

          {showPastDateWarning && (
            <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-3 mt-0.5" />
                <div>
                  <h3 className="font-medium text-yellow-900 dark:text-yellow-200">Start Date is in the Past</h3>
                  <p className="text-sm text-yellow-800 dark:text-yellow-300 mt-1">
                    This recurring task will only generate future tasks starting from the next occurrence on <strong>{nextOccurrence}</strong>.
                  </p>
                  <p className="text-sm text-yellow-800 dark:text-yellow-300 mt-1">
                    If you need tasks for past months, you must create them manually as regular tasks.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Task Name *
              </label>
              <input
                type="text"
                value={newTask.name}
                onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Monthly maintenance"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                rows={3}
                placeholder="Description of the recurring task"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Client *
              </label>
              <select
                value={newTask.clientId}
                onChange={(e) => setNewTask({ ...newTask, clientId: e.target.value, projectId: '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">Select client</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Project *
              </label>
              <select
                value={newTask.projectId}
                onChange={(e) => setNewTask({ ...newTask, projectId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                disabled={!newTask.clientId}
              >
                <option value="">Select project</option>
                {newTaskProjects.map(project => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Type
              </label>
              <select
                value={newTask.type}
                onChange={(e) => setNewTask({ ...newTask, type: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="incident">Incident</option>
                <option value="request">Request</option>
                <option value="insumos">Supplies</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Priority
              </label>
              <select
                value={newTask.priority}
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Day of Month
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={newTask.dayOfMonth}
                onChange={(e) => setNewTask({ ...newTask, dayOfMonth: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={newTask.recurringStartDate}
                onChange={(e) => setNewTask({ ...newTask, recurringStartDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Estimated Hours
              </label>
              <input
                type="number"
                step="0.5"
                value={newTask.estimatedHours || ''}
                onChange={(e) => setNewTask({ ...newTask, estimatedHours: parseFloat(e.target.value) || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Estimated Cost
              </label>
              <input
                type="number"
                step="0.01"
                value={newTask.estimatedCost || ''}
                onChange={(e) => setNewTask({ ...newTask, estimatedCost: parseFloat(e.target.value) || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            {nextOccurrence && (
              <div className="md:col-span-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-900 dark:text-blue-200">
                  <strong>Next occurrence:</strong> {nextOccurrence}
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveNew}
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Save className="w-4 h-4 mr-2" />
              Create Task
            </button>
          </div>
        </div>
      )}

      {/* Tasks Table */}
      <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            Loading recurring tasks...
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No recurring tasks found. Create your first one!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Task
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Client / Project
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Schedule
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Next Due
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredTasks.map((task) => {
                  const client = getClient(task.clientId);
                  const project = getProject(task.projectId);
                  const isEditing = editingTask?.id === task.id;

                  return (
                    <tr key={task.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{task.name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{task.description}</div>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              task.type === 'incident' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                              task.type === 'request' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                              'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            }`}>
                              {task.type}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              task.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                              task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                              'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            }`}>
                              {task.priority}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900 dark:text-white">{client?.name}</div>
                          <div className="text-gray-500 dark:text-gray-400">{project?.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        Day {task.dayOfMonth} of month
                        {task.estimatedHours && <div className="text-gray-500 dark:text-gray-400">{task.estimatedHours}h</div>}
                        {task.estimatedCost && <div className="text-gray-500 dark:text-gray-400">${task.estimatedCost}</div>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {format(new Date(task.nextDue), 'MMM d, yyyy')}
                        {task.lastGenerated && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Last: {format(new Date(task.lastGenerated), 'MMM d')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {task.isActive ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                            <XCircle className="w-3 h-3 mr-1" />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => setEditingTask(task)}
                          className="inline-flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(task.id)}
                          className="inline-flex items-center text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Recurring Task</h2>
                <button onClick={() => setEditingTask(null)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {showPastDateWarning && (
                <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <div className="flex items-start">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-3 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-yellow-900 dark:text-yellow-200">Start Date is in the Past</h3>
                      <p className="text-sm text-yellow-800 dark:text-yellow-300 mt-1">
                        This recurring task will only generate future tasks starting from the next occurrence on <strong>{nextOccurrence}</strong>.
                      </p>
                      <p className="text-sm text-yellow-800 dark:text-yellow-300 mt-1">
                        If you need tasks for past months, you must create them manually as regular tasks.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Task Name *
                  </label>
                  <input
                    type="text"
                    value={editingTask.name}
                    onChange={(e) => setEditingTask({ ...editingTask, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={editingTask.description}
                    onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Client *
                  </label>
                  <select
                    value={editingTask.clientId}
                    onChange={(e) => setEditingTask({ ...editingTask, clientId: e.target.value, projectId: '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="">Select client</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Project *
                  </label>
                  <select
                    value={editingTask.projectId}
                    onChange={(e) => setEditingTask({ ...editingTask, projectId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    disabled={!editingTask.clientId}
                  >
                    <option value="">Select project</option>
                    {clientProjects.map(project => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Day of Month
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={editingTask.dayOfMonth}
                    onChange={(e) => setEditingTask({ ...editingTask, dayOfMonth: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={editingTask.recurringStartDate || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, recurringStartDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Estimated Hours
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={editingTask.estimatedHours || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, estimatedHours: parseFloat(e.target.value) || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Estimated Cost
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingTask.estimatedCost || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, estimatedCost: parseFloat(e.target.value) || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={editingTask.isActive}
                      onChange={(e) => setEditingTask({ ...editingTask, isActive: e.target.checked })}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Active</span>
                  </label>
                </div>

                {nextOccurrence && (
                  <div className="md:col-span-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-sm text-blue-900 dark:text-blue-200">
                      <strong>Next occurrence:</strong> {nextOccurrence}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setEditingTask(null)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUpdate(editingTask.id)}
                  className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
