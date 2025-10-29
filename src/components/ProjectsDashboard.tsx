import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { format, parseISO } from 'date-fns';
import { Folder, AlertTriangle, FileText, Package, Clock, CheckCircle, DollarSign, Repeat, ChevronDown, ChevronUp } from 'lucide-react';
import { filterOutPendingRecurringReminders, getPendingRecurringReminders } from '../utils/taskFilters';
import { Link } from 'react-router-dom';

export function ProjectsDashboard() {
  const { projects, clients, tasks, getClient, getProjectTasks } = useApp();
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);

  // Force refresh when data changes
  React.useEffect(() => {
    setRefreshKey(prev => prev + 1);
  }, [projects.length, clients.length, tasks.length]);

  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'incident':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'insumos':
        return <Package className="w-4 h-4 text-purple-500" />;
      default:
        return <FileText className="w-4 h-4 text-blue-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-l-4 border-red-500';
      case 'medium':
        return 'border-l-4 border-yellow-500';
      default:
        return 'border-l-4 border-green-500';
    }
  };

  // Calculate overall statistics
  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => p.status === 'active').length;
  const completedProjects = projects.filter(p => p.status === 'completed').length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Projects</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{totalProjects}</p>
            </div>
            <Folder className="w-12 h-12 text-blue-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Projects</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">{activeProjects}</p>
            </div>
            <Clock className="w-12 h-12 text-blue-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Completed</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">{completedProjects}</p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-500 opacity-20" />
          </div>
        </div>
      </div>

      {/* Projects by Client with Kanban View */}
      <div className="bg-white rounded-lg shadow-lg p-6 dark:bg-gray-800">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Projects Overview</h2>

        <div className="space-y-6">
          {clients.map(client => {
            const clientProjects = projects.filter(p => p.clientId === client.id);

            if (clientProjects.length === 0) return null;

            const clientTotalTasks = clientProjects.reduce((sum, proj) => {
              const tasks = filterOutPendingRecurringReminders(getProjectTasks(proj.id));
              return sum + tasks.length;
            }, 0);

            const clientCompletedTasks = clientProjects.reduce((sum, proj) => {
              const tasks = filterOutPendingRecurringReminders(getProjectTasks(proj.id));
              return sum + tasks.filter(t => t.finished).length;
            }, 0);

            const clientTotalHours = clientProjects.reduce((sum, proj) => {
              const tasks = filterOutPendingRecurringReminders(getProjectTasks(proj.id));
              return sum + tasks.reduce((s, t) => s + (t.hours || 0), 0);
            }, 0);

            const clientTotalRevenue = clientTotalHours * (client.hourlyRate || 0);

            return (
              <div key={client.id} className="border-b pb-6 last:border-b-0 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {client.name}
                  </h3>
                  <div className="text-right">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {clientProjects.length} project{clientProjects.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                {/* Client Summary - Keep Hours and Revenue */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <FileText className="w-4 h-4 text-blue-500 mr-1" />
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Tasks</p>
                    </div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {clientCompletedTasks}/{clientTotalTasks}
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <Clock className="w-4 h-4 text-green-500 mr-1" />
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Hours</p>
                    </div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {clientTotalHours.toFixed(1)}h
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <DollarSign className="w-4 h-4 text-purple-500 mr-1" />
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Revenue</p>
                    </div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      ${clientTotalRevenue.toFixed(0)}
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <DollarSign className="w-4 h-4 text-blue-500 mr-1" />
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Rate</p>
                    </div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      ${client.hourlyRate || 0}/h
                    </p>
                  </div>
                </div>

                {/* Projects List with Kanban */}
                <div className="space-y-4">
                  {clientProjects.map(project => {
                    const allProjectTasks = getProjectTasks(project.id);
                    const projectTasks = filterOutPendingRecurringReminders(allProjectTasks);
                    const recurringReminders = getPendingRecurringReminders(allProjectTasks);

                    const pendingTasks = projectTasks.filter(t => !t.finished && t.status === 'pending');
                    const inProgressTasks = projectTasks.filter(t => !t.finished && t.status === 'in-progress');
                    const completedTasks = projectTasks.filter(t => t.finished);

                    const totalHours = projectTasks.reduce((sum, task) => sum + (task.hours || 0), 0);
                    const revenue = totalHours * (client.hourlyRate || 0);
                    const totalCost = projectTasks
                      .filter(t => t.type === 'insumos')
                      .reduce((sum, task) => sum + (task.cost || 0), 0);

                    const isExpanded = expandedProjects.has(project.id);

                    return (
                      <div key={project.id} className="bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg overflow-hidden">
                        {/* Project Header - Always Visible */}
                        <div
                          className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          onClick={() => toggleProject(project.id)}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-3 flex-1">
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                  {project.name}
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </h4>
                                {project.description && (
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{project.description}</p>
                                )}
                              </div>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                              project.status === 'active' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                              project.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                              'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            }`}>
                              {project.status}
                            </span>
                          </div>

                          {/* Metrics */}
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-gray-600 dark:text-gray-400 text-xs">Hours</p>
                              <p className="font-semibold text-gray-900 dark:text-white">{totalHours.toFixed(1)}h</p>
                            </div>
                            <div>
                              <p className="text-gray-600 dark:text-gray-400 text-xs">Revenue</p>
                              <p className="font-semibold text-gray-900 dark:text-white">${revenue.toFixed(0)}</p>
                            </div>
                            {totalCost > 0 && (
                              <div>
                                <p className="text-gray-600 dark:text-gray-400 text-xs">Supplies</p>
                                <p className="font-semibold text-gray-900 dark:text-white">${totalCost.toFixed(0)}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Kanban Board - Expandable */}
                        {isExpanded && projectTasks.length > 0 && (
                          <div className="border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {/* Pending Column */}
                              <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-3">
                                  <h5 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Pending</h5>
                                  <span className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium px-2 py-1 rounded-full">
                                    {pendingTasks.length}
                                  </span>
                                </div>
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                  {pendingTasks.map(task => (
                                    <Link
                                      key={task.id}
                                      to={`/edit-task/${task.id}`}
                                      className={`block p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:shadow-md transition-all ${getPriorityColor(task.priority)}`}
                                    >
                                      <div className="flex items-start gap-2">
                                        {getTaskIcon(task.type)}
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                            {task.description}
                                          </p>
                                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            {format(parseISO(task.date), 'MMM d')}
                                          </p>
                                          {task.isRecurring && (
                                            <div className="flex items-center gap-1 mt-1">
                                              <Repeat className="w-3 h-3 text-blue-500" />
                                              <span className="text-xs text-blue-600 dark:text-blue-400">Recurring</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </Link>
                                  ))}
                                  {pendingTasks.length === 0 && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
                                      No pending tasks
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* In Progress Column */}
                              <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-3">
                                  <h5 className="font-semibold text-sm text-blue-700 dark:text-blue-300">In Progress</h5>
                                  <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium px-2 py-1 rounded-full">
                                    {inProgressTasks.length}
                                  </span>
                                </div>
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                  {inProgressTasks.map(task => (
                                    <Link
                                      key={task.id}
                                      to={`/edit-task/${task.id}`}
                                      className={`block p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:shadow-md transition-all ${getPriorityColor(task.priority)}`}
                                    >
                                      <div className="flex items-start gap-2">
                                        {getTaskIcon(task.type)}
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                            {task.description}
                                          </p>
                                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            {format(parseISO(task.date), 'MMM d')}
                                          </p>
                                          {task.isRecurring && (
                                            <div className="flex items-center gap-1 mt-1">
                                              <Repeat className="w-3 h-3 text-blue-500" />
                                              <span className="text-xs text-blue-600 dark:text-blue-400">Recurring</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </Link>
                                  ))}
                                  {inProgressTasks.length === 0 && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
                                      No tasks in progress
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Completed Column */}
                              <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-3">
                                  <h5 className="font-semibold text-sm text-green-700 dark:text-green-300">Completed</h5>
                                  <span className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-medium px-2 py-1 rounded-full">
                                    {completedTasks.length}
                                  </span>
                                </div>
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                  {completedTasks.slice(0, 10).map(task => (
                                    <Link
                                      key={task.id}
                                      to={`/edit-task/${task.id}`}
                                      className="block p-3 bg-green-50 dark:bg-green-900/20 rounded-lg hover:shadow-md transition-all opacity-75"
                                    >
                                      <div className="flex items-start gap-2">
                                        {getTaskIcon(task.type)}
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate line-through">
                                            {task.description}
                                          </p>
                                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            {task.hours && `${task.hours}h • `}
                                            {format(parseISO(task.date), 'MMM d')}
                                          </p>
                                        </div>
                                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                      </div>
                                    </Link>
                                  ))}
                                  {completedTasks.length === 0 && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
                                      No completed tasks
                                    </p>
                                  )}
                                  {completedTasks.length > 10 && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
                                      +{completedTasks.length - 10} more
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Recurring Reminders */}
                        {recurringReminders.length > 0 && (
                          <div className="border-t dark:border-gray-700 p-4 bg-blue-50 dark:bg-blue-900/20">
                            <div className="flex items-center gap-2">
                              <Repeat className="w-4 h-4 text-blue-500" />
                              <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                                {recurringReminders.length} Recurring Reminder{recurringReminders.length !== 1 ? 's' : ''} pending completion
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
