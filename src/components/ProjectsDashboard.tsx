import React from 'react';
import { useApp } from '../context/AppContext';
import { format } from 'date-fns';
import { Folder, AlertTriangle, FileText, Package, Clock, CheckCircle, PauseCircle, Pencil } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export function ProjectsDashboard() {
  const { projects, clients, getClient, getProjectTasks } = useApp();
  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();

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

  const getTaskTypeIcon = (type: string) => {
    switch (type) {
      case 'incident':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'insumos':
        return <Package className="w-4 h-4 text-purple-500" />;
      default:
        return <FileText className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6 dark:bg-gray-800">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Projects Overview</h2>

        <div className="grid gap-6">
          {clients.map(client => {
            const clientProjects = projects.filter(p => p.clientId === client.id);
            
            if (clientProjects.length === 0) return null;

            return (
              <div key={client.id} className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b pb-2">
                  {client.name}
                </h3>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {clientProjects.map(project => {
                    const projectTasks = getProjectTasks(project.id);
                    const completedTasks = projectTasks.filter(t => t.finished).length;
                    const totalHours = projectTasks.reduce((sum, task) => sum + (task.hours || 0), 0);
                    const totalCost = projectTasks
                      .filter(t => t.type === 'insumos')
                      .reduce((sum, task) => sum + (task.cost || 0), 0);

                    return (
                      <div key={project.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow dark:border-gray-700">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(project.status)}
                            <h4 className="font-medium text-gray-900 dark:text-white">{project.name}</h4>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            project.status === 'active' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                            project.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          }`}>
                            {project.status}
                          </span>
                        </div>

                        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                          <div className="flex items-center justify-between">
                            <span>Tasks: {projectTasks.length}</span>
                            <span className="text-xs text-green-600 dark:text-green-400">
                              {completedTasks} completed
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Hours: {totalHours.toFixed(1)}h</span>
                            <span className="text-xs text-blue-600 dark:text-blue-400">
                              ${(totalHours * (getClient(project.clientId)?.hourlyRate || 0)).toFixed(0)}
                            </span>
                          </div>
                          {totalCost > 0 && (
                            <div className="flex items-center justify-between">
                              <span>Supplies:</span>
                              <span className="text-xs text-purple-600 dark:text-purple-400">
                                ${totalCost.toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>

                        {projectTasks.length > 0 && (
                          <div className="mt-4">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">Recent Tasks:</p>
                            <div className="space-y-2 max-h-32 overflow-y-auto">
                              {projectTasks
                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                .slice(0, 4)
                                .map(task => (
                                <div key={task.id} className="flex items-center justify-between text-sm group p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                  <div className="flex items-center space-x-2 flex-1">
                                    {getTaskTypeIcon(task.type)}
                                    <div className="flex-1 min-w-0">
                                      <p className="truncate dark:text-gray-300 text-xs">{task.description}</p>
                                      <div className="flex items-center space-x-2 mt-1">
                                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                          task.finished ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                                          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                                        }`}>
                                          {task.finished ? 'Done' : 'Pending'}
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                          {format(new Date(task.date), 'MMM d')}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => navigate(`/edit-task/${task.id}`)}
                                    className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-gray-200 rounded-full transition-all duration-200 dark:hover:bg-gray-600"
                                    title="Edit task"
                                  >
                                    <Pencil className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                                  </button>
                                </div>
                              ))}
                              {projectTasks.length > 4 && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 text-center pt-1">
                                  +{projectTasks.length - 4} more tasks
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {project.startDate && (
                          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
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