import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { format } from 'date-fns';
import { Folder, AlertTriangle, FileText, Package, Clock, CheckCircle, PauseCircle, TrendingUp, DollarSign, Target } from 'lucide-react';

export function ProjectsDashboard() {
  const { projects, clients, getClient, getProjectTasks } = useApp();
  const [refreshKey, setRefreshKey] = useState(0);

  // Force refresh when data changes
  React.useEffect(() => {
    setRefreshKey(prev => prev + 1);
  }, [projects.length, clients.length]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Clock className="w-5 h-5 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'on-hold':
        return <PauseCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Folder className="w-5 h-5 text-gray-500" />;
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 50) return 'bg-blue-500';
    if (percentage >= 25) return 'bg-yellow-500';
    return 'bg-red-500';
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

      {/* Projects by Client */}
      <div className="bg-white rounded-lg shadow-lg p-6 dark:bg-gray-800">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Projects Overview</h2>

        <div className="space-y-6">
          {clients.map(client => {
            const clientProjects = projects.filter(p => p.clientId === client.id);

            if (clientProjects.length === 0) return null;

            const clientTotalTasks = clientProjects.reduce((sum, proj) => {
              return sum + getProjectTasks(proj.id).length;
            }, 0);

            const clientCompletedTasks = clientProjects.reduce((sum, proj) => {
              return sum + getProjectTasks(proj.id).filter(t => t.finished).length;
            }, 0);

            const clientTotalHours = clientProjects.reduce((sum, proj) => {
              return sum + getProjectTasks(proj.id).reduce((s, t) => s + (t.hours || 0), 0);
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

                {/* Client Summary */}
                <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <Target className="w-4 h-4 text-blue-500 mr-1" />
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Tasks</p>
                    </div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {clientCompletedTasks}/{clientTotalTasks}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {clientTotalTasks > 0 ? Math.round((clientCompletedTasks / clientTotalTasks) * 100) : 0}% done
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
                </div>

                {/* Projects List */}
                <div className="space-y-3">
                  {clientProjects.map(project => {
                    const projectTasks = getProjectTasks(project.id);
                    const completedTasks = projectTasks.filter(t => t.finished).length;
                    const totalHours = projectTasks.reduce((sum, task) => sum + (task.hours || 0), 0);
                    const totalCost = projectTasks
                      .filter(t => t.type === 'insumos')
                      .reduce((sum, task) => sum + (task.cost || 0), 0);
                    const progress = projectTasks.length > 0 ? (completedTasks / projectTasks.length) * 100 : 0;
                    const revenue = totalHours * (client.hourlyRate || 0);

                    return (
                      <div key={project.id} className="bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3 flex-1">
                            {getStatusIcon(project.status)}
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900 dark:text-white">{project.name}</h4>
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

                        {/* Progress Bar */}
                        {projectTasks.length > 0 && (
                          <div className="mb-3">
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="text-gray-600 dark:text-gray-400">Progress</span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {completedTasks}/{projectTasks.length} tasks ({Math.round(progress)}%)
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all duration-500 ${getProgressColor(progress)}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        )}

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

                        {project.startDate && (
                          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                            Started: {format(new Date(project.startDate), 'MMM d, yyyy')}
                          </p>
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