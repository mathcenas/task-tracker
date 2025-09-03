import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { format, addDays } from 'date-fns';

export function TaskForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { clients, getClientProjects, addProject, addTask } = useApp();
  const [selectedClient, setSelectedClient] = useState('');
  const [formData, setFormData] = useState({
    projectId: '',
    newProject: '',
    description: '',
    hours: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'request' as 'incident' | 'request' | 'insumos',
    status: 'pending' as 'pending' | 'in-progress' | 'completed' | 'cancelled',
    priority: 'medium' as 'low' | 'medium' | 'high',
    cost: '',
    isRecurring: false,
    recurringDay: 1
  });
  
  const [showQuickActions, setShowQuickActions] = useState(false);

  // Check for template data in URL params
  React.useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const templateData = searchParams.get('template');
    
    if (templateData) {
      try {
        const template = JSON.parse(templateData);
        setFormData(prev => ({
          ...prev,
          description: template.description || prev.description,
          type: template.type || prev.type,
          priority: template.priority || prev.priority,
          hours: template.estimatedHours || prev.hours,
          cost: template.estimatedCost || prev.cost
        }));
        
        // Clear the URL params
        window.history.replaceState({}, '', location.pathname);
      } catch (error) {
        console.error('Error parsing template data:', error);
      }
    }
  }, [location]);

  const clientProjects = selectedClient ? getClientProjects(selectedClient) : [];
  
  const quickFillTask = (type: 'incident' | 'request' | 'insumos', description: string, priority: 'low' | 'medium' | 'high' = 'medium') => {
    setFormData(prev => ({
      ...prev,
      type,
      description,
      priority,
      date: format(new Date(), 'yyyy-MM-dd')
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalProjectId = formData.projectId;
    
    if (formData.projectId === 'new' && formData.newProject) {
      const newProject = {
        clientId: selectedClient,
        name: formData.newProject,
        status: 'active' as const
      };
      finalProjectId = addProject(newProject);
    }

    const task = {
      clientId: selectedClient,
      projectId: finalProjectId,
      description: formData.description,
      hours: formData.type !== 'insumos' ? Number(formData.hours) : undefined,
      cost: formData.type === 'insumos' ? Number(formData.cost) : undefined,
      date: formData.date,
      type: formData.type,
      status: formData.status,
      priority: formData.priority,
      finished: formData.type === 'insumos' ? true : (formData.hours && Number(formData.hours) > 0),
      isRecurring: formData.isRecurring,
      recurringDay: formData.isRecurring ? formData.recurringDay : undefined,
      createdAt: new Date().toISOString()
    };

    addTask(task);
    navigate('/');
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6 dark:bg-gray-800">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Add New Task</h2>
        
        {/* Quick Actions */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg dark:bg-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Quick Actions</h3>
            <button
              type="button"
              onClick={() => setShowQuickActions(!showQuickActions)}
              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              {showQuickActions ? 'Hide' : 'Show'} Templates
            </button>
          </div>
          
          {showQuickActions && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => quickFillTask('incident', 'Server down - urgent fix needed', 'high')}
                className="p-2 text-left text-xs bg-red-50 hover:bg-red-100 rounded border border-red-200 dark:bg-red-900/20 dark:border-red-800 dark:hover:bg-red-900/30"
              >
                🚨 Server Issue
              </button>
              <button
                type="button"
                onClick={() => quickFillTask('request', 'Website content update', 'medium')}
                className="p-2 text-left text-xs bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 dark:hover:bg-blue-900/30"
              >
                📝 Content Update
              </button>
              <button
                type="button"
                onClick={() => quickFillTask('request', 'Monthly maintenance check', 'low')}
                className="p-2 text-left text-xs bg-green-50 hover:bg-green-100 rounded border border-green-200 dark:bg-green-900/20 dark:border-green-800 dark:hover:bg-green-900/30"
              >
                🔧 Maintenance
              </button>
            </div>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Task Type
            </label>
            <div className="mt-2 space-x-4">
              <div className="grid grid-cols-3 gap-3">
                <label className="relative">
                  <input
                    type="radio"
                    className="sr-only peer"
                    name="type"
                    value="incident"
                    checked={formData.type === 'incident'}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'incident' | 'request' | 'insumos' }))}
                  />
                  <div className="p-3 border-2 rounded-lg cursor-pointer transition-all peer-checked:border-red-500 peer-checked:bg-red-50 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:peer-checked:bg-red-900/20 dark:peer-checked:border-red-500">
                    <div className="text-center">
                      <div className="text-red-500 font-medium">Incident</div>
                      <div className="text-xs text-gray-500 mt-1 dark:text-gray-400">Urgent issues</div>
                    </div>
                  </div>
                </label>
                <label className="relative">
                  <input
                    type="radio"
                    className="sr-only peer"
                    name="type"
                    value="request"
                    checked={formData.type === 'request'}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'incident' | 'request' | 'insumos' }))}
                  />
                  <div className="p-3 border-2 rounded-lg cursor-pointer transition-all peer-checked:border-blue-500 peer-checked:bg-blue-50 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:peer-checked:bg-blue-900/20 dark:peer-checked:border-blue-500">
                    <div className="text-center">
                      <div className="text-blue-500 font-medium">Request</div>
                      <div className="text-xs text-gray-500 mt-1 dark:text-gray-400">Regular work</div>
                    </div>
                  </div>
                </label>
                <label className="relative">
                  <input
                    type="radio"
                    className="sr-only peer"
                    name="type"
                    value="insumos"
                    checked={formData.type === 'insumos'}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'incident' | 'request' | 'insumos' }))}
                  />
                  <div className="p-3 border-2 rounded-lg cursor-pointer transition-all peer-checked:border-purple-500 peer-checked:bg-purple-50 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:peer-checked:bg-purple-900/20 dark:peer-checked:border-purple-500">
                    <div className="text-center">
                      <div className="text-purple-500 font-medium">Supplies</div>
                      <div className="text-xs text-gray-500 mt-1 dark:text-gray-400">Materials</div>
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="client" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Client *
            </label>
            <select
              id="client"
              required
              className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all duration-200"
              value={selectedClient}
              onChange={(e) => {
                setSelectedClient(e.target.value);
                setFormData(prev => ({ ...prev, projectId: '' }));
              }}
            >
              <option value="">Select a client</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="project" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Project *
            </label>
            <select
              id="project"
              required
              className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all duration-200"
              value={formData.projectId}
              onChange={(e) => setFormData(prev => ({ ...prev, projectId: e.target.value }))}
            >
              <option value="">Select a project</option>
              {clientProjects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
              <option value="new">+ Add New Project</option>
            </select>
          </div>

          {formData.projectId === 'new' && (
            <div>
              <label htmlFor="newProject" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                New Project Name *
              </label>
              <input
                type="text"
                id="newProject"
                required
                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all duration-200"
                value={formData.newProject}
                onChange={(e) => setFormData(prev => ({ ...prev, newProject: e.target.value }))}
                placeholder="Enter project name"
              />
            </div>
          )}

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Task Description *
            </label>
            <textarea
              id="description"
              required
              rows={3}
              className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all duration-200"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what needs to be done..."
            />
          </div>

          {formData.type !== 'insumos' ? (
            <div>
              <label htmlFor="hours" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Hours Worked (optional)
              </label>
              <input
                type="number"
                id="hours"
                min="0.25"
                step="0.25"
                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all duration-200"
                value={formData.hours}
                onChange={(e) => setFormData(prev => ({ ...prev, hours: e.target.value }))}
                placeholder="0.00"
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                💡 <strong>Tip:</strong> Enter hours to mark as completed, or leave empty to complete later from the dashboard.
              </p>
            </div>
          ) : (
            <div>
              <label htmlFor="cost" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Supply Cost *
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm dark:text-gray-400">$</span>
                </div>
                <input
                  type="number"
                  id="cost"
                  required
                  min="0.01"
                  step="0.01"
                  className="pl-7 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all duration-200"
                  value={formData.cost}
                  onChange={(e) => setFormData(prev => ({ ...prev, cost: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Date *
              </label>
              <input
                type="date"
                id="date"
                required
                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all duration-200"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>

            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Priority *
              </label>
              <select
                id="priority"
                required
                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all duration-200"
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as 'low' | 'medium' | 'high' }))}
              >
                <option value="low">🟢 Low Priority</option>
                <option value="medium">🟡 Medium Priority</option>
                <option value="high">🔴 High Priority</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 transition-all duration-200 cursor-pointer">
                <input
                  type="checkbox"
                  className="form-checkbox text-blue-600 rounded dark:bg-gray-700 h-4 w-4"
                  checked={formData.isRecurring}
                  onChange={(e) => setFormData(prev => ({ ...prev, isRecurring: e.target.checked }))}
                />
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Monthly Recurring Task
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    This task will repeat every month on the same day
                  </p>
                </div>
              </label>
            </div>

            {formData.isRecurring && (
              <div className="ml-7">
                <label htmlFor="recurringDay" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Day of Month
                </label>
                <input
                  type="number"
                  id="recurringDay"
                  min="1"
                  max="31"
                  className="mt-1 block w-32 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all duration-200"
                  value={formData.recurringDay}
                  onChange={(e) => setFormData(prev => ({ ...prev, recurringDay: parseInt(e.target.value) }))}
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Task will recur on day {formData.recurringDay} of each month
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t dark:border-gray-700">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-6 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-all duration-200 transform hover:scale-105"
            >
              {formData.hours ? 'Add & Complete Task' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}