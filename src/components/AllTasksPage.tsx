import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { format, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns';
import { AlertTriangle, FileText, Package, CheckCircle, Clock, Calendar, Plus, Pencil, Check, X, Download, Trash2, CheckSquare, Square, ThumbsUp, ThumbsDown, Copy } from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CompletionModal } from './CompletionModal';
import { TaskFilters } from './ui/TaskFilters';
import { TaskStatusBadge } from './TaskStatusBadge';
import { exportTasksToCSV } from '../utils/csvExport';
import { BulkTaskOperations } from './BulkTaskOperations';
import { api } from '../services/api';

export function AllTasksPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { tasks, getClient, getProject, updateTask, deleteTask, clients, projects, reloadTasks } = useApp();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [isBulkOpen, setIsBulkOpen] = useState(false);

  // Read filter state from URL so it survives navigation away and back
  const taskFilter = (searchParams.get('status') || 'all') as 'all' | 'overdue' | 'today' | 'upcoming' | 'completed' | 'in_progress' | 'not_started' | 'recently_added' | 'duplicates';
  const typeFilter = (searchParams.get('type') || 'all') as 'all' | 'incident' | 'request' | 'insumos';
  const priorityFilter = (searchParams.get('priority') || 'all') as 'all' | 'high' | 'medium' | 'low';
  const clientFilter = searchParams.get('client') || 'all';
  const projectFilter = searchParams.get('project') || 'all';

  // Single point of truth for URL param updates — avoids race conditions from
  // multiple setSearchParams calls in the same event handler.
  const setFilters = (updates: Record<string, string>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([key, value]) => {
        if (value === 'all' || value === '') next.delete(key);
        else next.set(key, value);
      });
      return next;
    }, { replace: true });
  };

  const setTaskFilter = (v: typeof taskFilter) => setFilters({ status: v });
  const setTypeFilter = (v: typeof typeFilter) => setFilters({ type: v });
  const setPriorityFilter = (v: typeof priorityFilter) => setFilters({ priority: v });
  const setClientFilter = (v: string) => setFilters({ client: v, project: 'all' });
  const setProjectFilter = (v: string) => setFilters({ project: v });


  // Helper: apply secondary filters (client, project, type, priority) to any task list
  const applySecondaryFilters = (list: typeof tasks) =>
    list.filter(task => {
      if (typeFilter !== 'all' && task.type !== typeFilter) return false;
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
      if (clientFilter !== 'all' && String(task.clientId) !== String(clientFilter)) return false;
      if (projectFilter !== 'all' && String(task.projectId) !== String(projectFilter)) return false;
      return true;
    });

  // Base categorised pools (secondary filters applied for consistent counts)
  const allUnfinishedTasks = applySecondaryFilters(tasks.filter(task => !task.finished));
  const completedTasks = applySecondaryFilters(tasks.filter(task => task.finished));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdueTasks = allUnfinishedTasks.filter(task => {
    const d = parseISO(task.date + 'T00:00:00');
    d.setHours(0, 0, 0, 0);
    return d < today;
  });
  const todayTasks = allUnfinishedTasks.filter(task => isToday(parseISO(task.date + 'T00:00:00')));
  const upcomingTasks = allUnfinishedTasks.filter(task => {
    const d = parseISO(task.date + 'T00:00:00');
    d.setHours(0, 0, 0, 0);
    return d > today;
  });
  const inProgressTasks = allUnfinishedTasks.filter(task => task.status === 'in_progress');
  const notStartedTasks = allUnfinishedTasks.filter(task => task.status === 'not_started');
  const recentlyAddedTasks = applySecondaryFilters([...tasks])
    .sort((a, b) => {
      const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bCreated - aCreated;
    })
    .slice(0, 20);

  // Group ALL tasks by normalized description to find duplicates
  const duplicateGroups = (() => {
    const grouped = new Map<string, typeof tasks>();
    applySecondaryFilters(tasks).forEach(t => {
      const key = t.description.trim().toLowerCase();
      const group = grouped.get(key) || [];
      group.push(t);
      grouped.set(key, group);
    });
    return [...grouped.values()]
      .filter(g => g.length >= 2)
      .sort((a, b) => b.length - a.length);
  })();
  const duplicateTasks = duplicateGroups.flat();

  // Apply status filter
  let filteredTasks: typeof tasks;
  if (taskFilter === 'overdue') filteredTasks = overdueTasks;
  else if (taskFilter === 'today') filteredTasks = todayTasks;
  else if (taskFilter === 'upcoming') filteredTasks = upcomingTasks;
  else if (taskFilter === 'completed') filteredTasks = completedTasks;
  else if (taskFilter === 'in_progress') filteredTasks = inProgressTasks;
  else if (taskFilter === 'not_started') filteredTasks = notStartedTasks;
  else if (taskFilter === 'recently_added') filteredTasks = recentlyAddedTasks;
  else if (taskFilter === 'duplicates') filteredTasks = duplicateTasks;
  else filteredTasks = allUnfinishedTasks; // 'all'

  // Sort tasks: latest created first (recently_added already sorted)
  const sortedTasks = taskFilter === 'recently_added'
    ? filteredTasks
    : [...filteredTasks].sort((a, b) => {
        const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bCreated - aCreated;
      });

  const getRelativeDate = (date: string) => {
    const taskDate = parseISO(date);
    if (isToday(taskDate)) return 'Today';
    if (isTomorrow(taskDate)) return 'Tomorrow';
    if (isYesterday(taskDate)) return 'Yesterday';
    return format(taskDate, 'MMM d, yyyy');
  };

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'incident':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'insumos':
        return <Package className="w-5 h-5 text-purple-500" />;
      default:
        return <FileText className="w-5 h-5 text-blue-500" />;
    }
  };

  const handleCompleteClick = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setSelectedTaskId(taskId);
      setIsModalOpen(true);
    }
  };

  const handleTaskComplete = (hours: number) => {
    if (selectedTaskId) {
      const task = tasks.find(t => t.id === selectedTaskId);
      if (task) {
        if (task.type === 'insumos') {
          updateTask({ ...task, finished: true, status: 'completed', completedAt: new Date().toISOString() });
        } else {
          updateTask({ ...task, hours, finished: true, status: 'completed', completedAt: new Date().toISOString() });
        }
      }
      setIsModalOpen(false);
      setSelectedTaskId(null);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task && window.confirm(`Are you sure you want to delete this task?\n\n"${task.description}"`)) {
      try {
        await deleteTask(taskId);
      } catch (error) {
        console.error('Error deleting task:', error);
        alert('Failed to delete task. Please try again.');
      }
    }
  };

  const handleApprovalToggle = async (taskId: string, newStatus: 'approved' | 'rejected') => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const approvalStatus = task.approvalStatus === newStatus ? 'pending' : newStatus;
    try {
      await api.updateTask(taskId, { ...task, approvalStatus });
      await reloadTasks();
    } catch (error) {
      console.error('Error updating approval status:', error);
    }
  };

  const clearFilters = () => {
    setSearchParams({}, { replace: true });
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedTasks(new Set(sortedTasks.map(t => t.id)));
  };

  const deselectAll = () => {
    setSelectedTasks(new Set());
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">All Tasks</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Complete task management and to-do list
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => exportTasksToCSV(sortedTasks, getClient, getProject, `all-tasks-${format(new Date(), 'yyyy-MM-dd')}.csv`)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
          <Link
            to="/add-task"
            state={{ from: '/tasks' }}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Task
          </Link>
        </div>
      </div>

      {/* Task Status Filter Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div
          className={`bg-white rounded-md border-2 p-6 dark:bg-gray-800 cursor-pointer hover:shadow-xl transition-all duration-200 hover:scale-[1.02] ${
            taskFilter === 'all'
              ? 'border-blue-500 shadow-lg'
              : 'border-gray-200 dark:border-gray-700'
          }`}
          onClick={() => setTaskFilter('all')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Tasks</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{allUnfinishedTasks.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Click to view all</p>
            </div>
            <FileText className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div
          className={`bg-white rounded-md border-2 p-6 dark:bg-gray-800 cursor-pointer hover:shadow-xl transition-all duration-200 hover:scale-[1.02] ${
            taskFilter === 'recently_added'
              ? 'border-cyan-500 shadow-lg'
              : 'border-gray-200 dark:border-gray-700'
          }`}
          onClick={() => setTaskFilter('recently_added')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Recently Added</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{recentlyAddedTasks.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Latest tasks</p>
            </div>
            <Calendar className="w-8 h-8 text-cyan-500" />
          </div>
        </div>

        <div
          className={`bg-white rounded-md border-2 p-6 dark:bg-gray-800 cursor-pointer hover:shadow-xl transition-all duration-200 hover:scale-[1.02] ${
            taskFilter === 'in_progress'
              ? 'border-yellow-500 shadow-lg'
              : 'border-gray-200 dark:border-gray-700'
          }`}
          onClick={() => setTaskFilter('in_progress')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">In Progress</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{inProgressTasks.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Active tasks</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        <div
          className={`bg-white rounded-md border-2 p-6 dark:bg-gray-800 cursor-pointer hover:shadow-xl transition-all duration-200 hover:scale-[1.02] ${
            taskFilter === 'not_started'
              ? 'border-orange-500 shadow-lg'
              : 'border-gray-200 dark:border-gray-700'
          }`}
          onClick={() => setTaskFilter('not_started')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Not Started</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{notStartedTasks.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Pending tasks</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-500" />
          </div>
        </div>

        <div
          className={`bg-white rounded-md border-2 p-6 dark:bg-gray-800 cursor-pointer hover:shadow-xl transition-all duration-200 hover:scale-[1.02] ${
            taskFilter === 'completed'
              ? 'border-green-500 shadow-lg'
              : 'border-gray-200 dark:border-gray-700'
          }`}
          onClick={() => setTaskFilter('completed')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{completedTasks.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Finished tasks</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div
          className={`bg-white rounded-md border-2 p-6 dark:bg-gray-800 cursor-pointer hover:shadow-xl transition-all duration-200 hover:scale-[1.02] ${
            taskFilter === 'duplicates'
              ? 'border-amber-500 shadow-lg'
              : duplicateGroups.length > 0
              ? 'border-amber-200 dark:border-amber-800'
              : 'border-gray-200 dark:border-gray-700'
          }`}
          onClick={() => setTaskFilter('duplicates')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Duplicates</p>
              <p className={`text-3xl font-bold ${duplicateGroups.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
                {duplicateGroups.length}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {duplicateGroups.length > 0 ? `${duplicateTasks.length} tasks` : 'No duplicates'}
              </p>
            </div>
            <Copy className={`w-8 h-8 ${duplicateGroups.length > 0 ? 'text-amber-500' : 'text-gray-400'}`} />
          </div>
        </div>
      </div>


      {/* Additional Filters */}
      <div className="bg-white rounded-lg shadow p-4 dark:bg-gray-800">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Client
            </label>
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Project
            </label>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              disabled={clientFilter === 'all'}
            >
              <option value="all">All Projects</option>
              {projects
                .filter(p => clientFilter === 'all' || String(p.clientId) === String(clientFilter))
                .map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="all">All Types</option>
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
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="all">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {filteredTasks.length > 0 && (
          <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            Showing {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Selection bar */}
      {sortedTasks.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={selectedTasks.size === sortedTasks.length ? deselectAll : selectAll}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {selectedTasks.size === sortedTasks.length
                ? <CheckSquare className="w-4 h-4 text-blue-500" />
                : <Square className="w-4 h-4" />
              }
              {selectedTasks.size === sortedTasks.length ? 'Deselect All' : 'Select All'}
            </button>
            {selectedTasks.size > 0 && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {selectedTasks.size} of {sortedTasks.length} selected
              </span>
            )}
          </div>
          {selectedTasks.size > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsBulkOpen(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <CheckSquare className="w-4 h-4 mr-2" />
                Bulk Actions ({selectedTasks.size})
              </button>
              <button
                onClick={deselectAll}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="Clear selection"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tasks List */}
      <div className="bg-white rounded-lg shadow dark:bg-gray-800">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {taskFilter === 'recently_added'
                ? `Recently Added Tasks (${filteredTasks.length})`
                : taskFilter === 'duplicates'
                ? `Duplicate Groups (${duplicateGroups.length} groups · ${duplicateTasks.length} tasks)`
                : `Tasks (${filteredTasks.length})`}
            </h3>
            {taskFilter === 'duplicates' && duplicateGroups.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-full">
                Tasks grouped by identical description
              </p>
            )}
          </div>

          {/* Grouped duplicate view */}
          {taskFilter === 'duplicates' && (
            <div className="space-y-6">
              {duplicateGroups.length === 0 && (
                <div className="text-center py-12">
                  <Copy className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">No duplicate descriptions found</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">All task descriptions are unique</p>
                </div>
              )}
              {duplicateGroups.map((group, gi) => {
                const key = group[0].description.trim().toLowerCase();
                return (
                  <div key={key} className="border-2 border-amber-200 dark:border-amber-800 rounded-xl overflow-hidden">
                    {/* Group header */}
                    <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-900/20 px-4 py-3 border-b border-amber-200 dark:border-amber-800">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Copy className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 truncate">
                          "{group[0].description}"
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                        <span className="text-xs font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">
                          {group.length} tasks
                        </span>
                        <button
                          onClick={() => {
                            group.forEach(t => setSelectedTasks(prev => { const n = new Set(prev); n.add(t.id); return n; }));
                          }}
                          className="text-xs text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                        >
                          Select all
                        </button>
                      </div>
                    </div>
                    {/* Group tasks */}
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {group.map(task => {
                        const client = getClient(task.clientId);
                        const project = getProject(task.projectId);
                        const isSelected = selectedTasks.has(task.id);
                        return (
                          <div
                            key={task.id}
                            className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                              isSelected ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleTaskSelection(task.id)}
                              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-900 dark:text-white truncate">{client?.name || '—'}</span>
                                <span className="text-gray-400 text-xs">·</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{project?.name || '—'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                                  task.type === 'incident' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                  task.type === 'insumos' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                }`}>{task.type}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                                  task.finished ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                }`}>{task.finished ? 'completed' : task.status}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-500 dark:text-gray-400">{format(parseISO(task.date + 'T00:00:00'), 'MMM d, yyyy')}</span>
                                {task.hours != null && <span className="text-xs text-gray-500 dark:text-gray-400">{task.hours}h</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Link
                                to={`/edit-task/${task.id}`}
                                state={{ from: `${location.pathname}${location.search}` }}
                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Pencil className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                              </Link>
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Normal task list */}
          {taskFilter !== 'duplicates' && (
          <div className="space-y-3">
            {sortedTasks.map(task => {
              const client = getClient(task.clientId);
              const project = getProject(task.projectId);
              const isOverdue = !task.finished && new Date(task.date) < new Date();
              const isSelected = selectedTasks.has(task.id);

              return (
                <div
                  key={task.id}
                  className={`border rounded-lg p-4 transition-all duration-200 hover:shadow-md ${
                    isSelected
                      ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/10'
                      : task.finished
                      ? 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800'
                      : isOverdue
                      ? 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800'
                      : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-start space-x-3 flex-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleTaskSelection(task.id)}
                        onClick={e => e.stopPropagation()}
                        className="mt-1 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                      />
                      {getTaskIcon(task.type)}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium text-gray-900 dark:text-white">{client?.name}</h4>
                          <span className="text-sm text-gray-500 dark:text-gray-400">•</span>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{project?.name}</p>
                          {task.finished && (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{task.description}</p>
                        <div className="flex items-center space-x-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            task.type === 'incident' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                            task.type === 'insumos' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                            'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          }`}>
                            {task.type}
                          </span>
                          <TaskStatusBadge status={task.status} size="sm" />
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            task.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                            task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                            'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          }`}>
                            {task.priority}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {getRelativeDate(task.date)}
                          </span>
                          {isOverdue && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                              Overdue
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <div className="text-right">
                        {task.type === 'insumos' ? (
                          <div className="flex flex-col items-end gap-1">
                            <p className="text-sm font-medium text-green-600 dark:text-green-400">
                              ${task.cost?.toFixed(2)}
                            </p>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleApprovalToggle(task.id, 'approved')}
                                className={`p-1 rounded transition-colors ${
                                  task.approvalStatus === 'approved'
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : 'text-gray-400 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/20 dark:hover:text-green-400'
                                }`}
                                title={task.approvalStatus === 'approved' ? 'Approved (click to undo)' : 'Approve cost'}
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleApprovalToggle(task.id, 'rejected')}
                                className={`p-1 rounded transition-colors ${
                                  task.approvalStatus === 'rejected'
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    : 'text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400'
                                }`}
                                title={task.approvalStatus === 'rejected' ? 'Rejected (click to undo)' : 'Reject cost'}
                              >
                                <ThumbsDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : task.finished ? (
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {task.hours?.toFixed(1)}h
                            </p>
                            <p className="text-sm text-green-600 dark:text-green-400">
                              ${((task.hours || 0) * (client?.hourlyRate || 0)).toFixed(2)}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Pending</p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-1">
                        <Link
                          to={`/edit-task/${task.id}`}
                          state={{ from: `${location.pathname}${location.search}` }}
                          className="p-2 hover:bg-gray-100 rounded-lg dark:hover:bg-gray-600 transition-colors"
                          title="Edit task"
                        >
                          <Pencil className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        </Link>
                        {!task.finished && (
                          <button
                            onClick={() => handleCompleteClick(task.id)}
                            className="p-2 hover:bg-green-100 rounded-lg dark:hover:bg-green-900/20 transition-colors"
                            title="Complete task"
                          >
                            <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-2 hover:bg-red-100 rounded-lg dark:hover:bg-red-900/20 transition-colors"
                          title="Delete task"
                        >
                          <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredTasks.length === 0 && (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">No tasks found</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                  {tasks.length === 0
                    ? "Add your first task to get started"
                    : "Try adjusting your filters or search terms"
                  }
                </p>
                <Link
                  to="/add-task"
                  state={{ from: '/tasks' }}
                  className="inline-flex items-center mt-4 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add a task
                </Link>
              </div>
            )}
          </div>
          )}
        </div>
      </div>

      <CompletionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTaskId(null);
        }}
        onComplete={handleTaskComplete}
        taskType={selectedTaskId ? tasks.find(t => t.id === selectedTaskId)?.type || 'request' : 'request'}
        taskDescription={selectedTaskId ? tasks.find(t => t.id === selectedTaskId)?.description : undefined}
        existingHours={selectedTaskId ? tasks.find(t => t.id === selectedTaskId)?.hours ?? undefined : undefined}
      />

      <BulkTaskOperations
        selectedTasks={Array.from(selectedTasks)}
        onSelectionChange={(ids) => setSelectedTasks(new Set(ids))}
        isOpen={isBulkOpen}
        onClose={() => setIsBulkOpen(false)}
      />
    </div>
  );
}