import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { format, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns';
import { AlertTriangle, FileText, Package, CheckCircle, Clock, Calendar, Plus, Pencil, Check, X, Download } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { CompletionModal } from './CompletionModal';
import { TaskFilters } from './ui/TaskFilters';
import { TaskStatusBadge } from './TaskStatusBadge';
import { exportTasksToCSV } from '../utils/csvExport';

export function AllTasksPage() {
  const location = useLocation();
  const { tasks, getClient, getProject, updateTask, clients, projects } = useApp();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [taskFilter, setTaskFilter] = useState<'all' | 'overdue' | 'today' | 'upcoming' | 'completed' | 'in_progress' | 'not_started'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'incident' | 'request' | 'insumos'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [refreshKey, setRefreshKey] = useState(0);

  // Force refresh when tasks change
  React.useEffect(() => {
    setRefreshKey(prev => prev + 1);
  }, [tasks.length]);


  // Categorize tasks
  const allUnfinishedTasks = tasks.filter(task => !task.finished);
  const overdueTasks = allUnfinishedTasks.filter(task => {
    const taskDate = parseISO(task.date + 'T00:00:00');
    taskDate.setHours(0, 0, 0, 0);
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    return taskDate < todayDate;
  });
  const todayTasks = allUnfinishedTasks.filter(task => isToday(parseISO(task.date + 'T00:00:00')));
  const upcomingTasks = allUnfinishedTasks.filter(task => {
    const taskDate = parseISO(task.date + 'T00:00:00');
    taskDate.setHours(0, 0, 0, 0);
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    return taskDate > todayDate;
  });
  const completedTasks = tasks.filter(task => task.finished);

  // Apply status filter
  let filteredTasks = [...tasks];
  if (taskFilter === 'overdue') {
    filteredTasks = overdueTasks;
  } else if (taskFilter === 'today') {
    filteredTasks = todayTasks;
  } else if (taskFilter === 'upcoming') {
    filteredTasks = upcomingTasks;
  } else if (taskFilter === 'completed') {
    filteredTasks = completedTasks;
  } else if (taskFilter === 'in_progress') {
    filteredTasks = tasks.filter(task => !task.finished && task.status === 'in_progress');
  } else if (taskFilter === 'not_started') {
    filteredTasks = tasks.filter(task => !task.finished && task.status === 'not_started');
  } else if (taskFilter === 'all') {
    filteredTasks = allUnfinishedTasks;
  }

  // Apply other filters
  filteredTasks = filteredTasks.filter(task => {
    // Type filter
    if (typeFilter !== 'all' && task.type !== typeFilter) return false;

    // Priority filter
    if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;

    // Client filter
    if (clientFilter !== 'all' && task.clientId !== clientFilter) return false;

    // Project filter
    if (projectFilter !== 'all' && task.projectId !== projectFilter) return false;

    return true;
  });

  // Sort tasks: pending first (by priority, then date), then completed (by date desc)
  const sortedTasks = filteredTasks.sort((a, b) => {
    // If one is finished and other isn't, pending comes first
    if (a.finished !== b.finished) {
      return a.finished ? 1 : -1;
    }

    // If both are pending, sort by priority then date
    if (!a.finished && !b.finished) {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    }

    // If both are completed, sort by date descending
    return new Date(b.date).getTime() - new Date(a.date).getTime();
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

  const clearFilters = () => {
    setTaskFilter('all');
    setTypeFilter('all');
    setPriorityFilter('all');
  };

  const pendingCount = allUnfinishedTasks.length;
  const completedCount = completedTasks.length;
  const overdueCount = overdueTasks.length;

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
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Task
          </Link>
        </div>
      </div>

      {/* Task Status Filter Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Click to view all
              </p>
            </div>
            <FileText className="w-8 h-8 text-blue-500" />
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
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {tasks.filter(t => !t.finished && t.status === 'in_progress').length}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Active tasks
              </p>
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
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {tasks.filter(t => !t.finished && t.status === 'not_started').length}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Pending tasks
              </p>
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
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Finished tasks
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
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
              onChange={(e) => {
                setClientFilter(e.target.value);
                setProjectFilter('all');
              }}
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
                .filter(p => clientFilter === 'all' || p.clientId === clientFilter)
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
              onClick={() => {
                setPriorityFilter('all');
                setTypeFilter('all');
                setClientFilter('all');
                setProjectFilter('all');
              }}
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

      {/* Tasks List */}
      <div className="bg-white rounded-lg shadow dark:bg-gray-800">
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">
            Tasks ({filteredTasks.length})
          </h3>

          <div className="space-y-3">
            {sortedTasks.map(task => {
              const client = getClient(task.clientId);
              const project = getProject(task.projectId);
              const isOverdue = !task.finished && new Date(task.date) < new Date();
              
              return (
                <div 
                  key={task.id} 
                  className={`border rounded-lg p-4 transition-all duration-200 hover:shadow-md ${
                    task.finished 
                      ? 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800' 
                      : isOverdue
                      ? 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800'
                      : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-start space-x-3 flex-1">
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
                          <div>
                            <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                              ${task.cost?.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Supply cost</p>
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
                          state={{ from: location.pathname + location.search }}
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
                  className="inline-flex items-center mt-4 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add a task
                </Link>
              </div>
            )}
          </div>
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
      />
    </div>
  );
}