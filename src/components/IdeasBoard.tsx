import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate, Link } from 'react-router-dom';
import { Lightbulb, Clock, AlertTriangle, Plus, Save, X, CreditCard as Edit2, Calendar, User, Tag, FileText, Folder, ChevronDown } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import { apiService } from '../services/api';
import { exportProjectIdeasPDF } from '../utils/projectIdeasPdfExport';

export function IdeasBoard() {
  const { tasks, clients, projects, getClient, getProject, updateTask } = useApp();
  const navigate = useNavigate();
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'overdue' | 'in_progress'>('all');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [exporting, setExporting] = useState(false);

  const filteredProjects = useMemo(() => {
    if (filterClient === 'all') return projects;
    return projects.filter(p => p.clientId === filterClient);
  }, [projects, filterClient]);

  const incompleteTasks = useMemo(() => {
    return tasks.filter(task => {
      if (task.finished) return false;

      const isOverdue = isPast(parseISO(task.date)) && task.status !== 'completed';
      const isInProgress = task.status === 'in_progress';

      if (!isOverdue && !isInProgress) return false;

      if (filterType === 'overdue' && !isOverdue) return false;
      if (filterType === 'in_progress' && !isInProgress) return false;
      if (filterClient !== 'all' && task.clientId !== filterClient) return false;
      if (filterProject !== 'all' && task.projectId !== filterProject) return false;

      return true;
    });
  }, [tasks, filterType, filterClient, filterProject]);

  const canExport = filterProject !== 'all';

  const handleExportPDF = async () => {
    if (!canExport) return;

    const project = projects.find(p => p.id === filterProject);
    if (!project) return;

    const client = clients.find(c => c.id === project.clientId);
    if (!client) return;

    const projectTasks = tasks.filter(t => t.projectId === filterProject && !t.finished);

    setExporting(true);
    try {
      const companySettings = await apiService.getCompanySettings();
      await exportProjectIdeasPDF(project, client, projectTasks, companySettings);
    } catch (error) {
      console.error('Failed to export PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleEditNotes = (task: any) => {
    setEditingTask(task.id);
    setEditNotes(task.notes || '');
  };

  const handleSaveNotes = async (task: any) => {
    try {
      await updateTask({ ...task, notes: editNotes });
      setEditingTask(null);
      setEditNotes('');
    } catch (error) {
      console.error('Failed to update notes:', error);
      alert('Failed to save notes');
    }
  };

  const handleCancelEdit = () => {
    setEditingTask(null);
    setEditNotes('');
  };

  const getTaskColor = (task: any) => {
    const isOverdue = isPast(parseISO(task.date)) && task.status !== 'completed';

    if (isOverdue && task.priority === 'high') {
      return 'from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-700';
    } else if (isOverdue) {
      return 'from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-700';
    } else if (task.priority === 'high') {
      return 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-700';
    } else {
      return 'from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-700';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'incident':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'insumos':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />;
      case 'medium':
        return <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const selectedProject = filterProject !== 'all' ? projects.find(p => p.id === filterProject) : null;
  const selectedClient = selectedProject ? clients.find(c => c.id === selectedProject.clientId) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                <Lightbulb className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Ideas & Active Tasks</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Brainstorm improvements and track work in progress
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {canExport && (
                <button
                  onClick={handleExportPDF}
                  disabled={exporting}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium"
                >
                  <FileText className="w-4 h-4" />
                  <span>{exporting ? 'Generating...' : 'Export Summary PDF'}</span>
                </button>
              )}
              <div className="text-right">
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {incompleteTasks.length}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Active Tasks
                </div>
              </div>
            </div>
          </div>

          {canExport && selectedProject && selectedClient && (
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Folder className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <span className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                    {selectedProject.name}
                  </span>
                  <span className="text-sm text-blue-600 dark:text-blue-400 ml-2">
                    — {selectedClient.name}
                  </span>
                </div>
              </div>
              <div className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Rate: €{selectedClient.hourlyRate.toFixed(2)}/hr
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-4 items-center bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter:</span>
              <div className="flex space-x-2">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filterType === 'all'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterType('overdue')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filterType === 'overdue'
                      ? 'bg-orange-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Overdue
                </button>
                <button
                  onClick={() => setFilterType('in_progress')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filterType === 'in_progress'
                      ? 'bg-green-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  In Progress
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-gray-400" />
              <select
                value={filterClient}
                onChange={(e) => {
                  setFilterClient(e.target.value);
                  setFilterProject('all');
                }}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="all">All Clients</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <Folder className="w-4 h-4 text-gray-400" />
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="all">All Projects</option>
                {filteredProjects.map(project => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </div>

            {canExport && (
              <div className="ml-auto">
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-full border border-blue-200 dark:border-blue-800">
                  Project selected — PDF export available
                </span>
              </div>
            )}
          </div>
        </div>

        {incompleteTasks.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full mb-4">
              <Lightbulb className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              All caught up!
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              No overdue or in-progress tasks at the moment.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {incompleteTasks.map(task => {
              const client = getClient(task.clientId);
              const project = getProject(task.projectId);
              const isOverdue = isPast(parseISO(task.date)) && task.status !== 'completed';
              const isEditing = editingTask === task.id;

              return (
                <div
                  key={task.id}
                  className={`bg-gradient-to-br ${getTaskColor(task)} border-2 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden`}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        {getPriorityIcon(task.priority)}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(task.type)}`}>
                          {task.type}
                        </span>
                        {isOverdue && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                            Overdue
                          </span>
                        )}
                      </div>
                      <Link
                        to={`/edit-task/${task.id}`}
                        state={{ from: '/ideas' }}
                        className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Link>
                    </div>

                    <div className="mb-4">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2 line-clamp-3">
                        {task.description}
                      </p>

                      <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                        <div className="flex items-center space-x-2">
                          <User className="w-3 h-3" />
                          <span className="font-medium">{client?.name || 'Unknown'}</span>
                        </div>
                        {project && (
                          <div className="flex items-center space-x-2">
                            <Tag className="w-3 h-3" />
                            <span>{project.name}</span>
                          </div>
                        )}
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-3 h-3" />
                          <span className={isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                            {format(parseISO(task.date), 'MMM d, yyyy')}
                          </span>
                        </div>
                        {task.hours !== undefined && task.hours > 0 && (
                          <div className="flex items-center space-x-2">
                            <Clock className="w-3 h-3" />
                            <span>{task.hours}h estimated</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-600 pt-4 mt-4">
                      {isEditing ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Ideas & Notes
                            </label>
                            <textarea
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              placeholder="Add your ideas for improving this service..."
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-none"
                              rows={4}
                            />
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleSaveNotes(task)}
                              className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                            >
                              <Save className="w-4 h-4" />
                              <span>Save</span>
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="px-3 py-2 bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          {task.notes ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                  Ideas & Notes
                                </span>
                                <button
                                  onClick={() => handleEditNotes(task)}
                                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap line-clamp-4">
                                {task.notes}
                              </p>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleEditNotes(task)}
                              className="w-full flex items-center justify-center space-x-2 px-3 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                            >
                              <Plus className="w-4 h-4" />
                              <span>Add ideas</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
