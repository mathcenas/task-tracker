import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { format } from 'date-fns';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';

export function EditTask() {
  const navigate = useNavigate();
  const { taskId } = useParams<{ taskId: string }>();
  const { getTask, updateTask, deleteTask, getClient, getProject } = useApp();
  
  const task = taskId ? getTask(taskId) : null;
  const [formData, setFormData] = useState({
    description: '',
    hours: '',
    cost: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'request' as 'incident' | 'request' | 'insumos',
    status: 'in_progress' as 'not_started' | 'in_progress' | 'review' | 'completed',
    priority: 'medium' as 'low' | 'medium' | 'high',
    notes: '',
    finished: false
  });

  useEffect(() => {
    if (task) {
      setFormData({
        description: task.description,
        hours: task.hours?.toString() || '',
        cost: task.cost?.toString() || '',
        date: task.date,
        type: task.type,
        status: task.status,
        priority: task.priority,
        notes: task.notes || '',
        finished: task.finished
      });
    }
  }, [task]);

  if (!task) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 dark:bg-gray-800">
          <p className="text-gray-500 dark:text-gray-400">Task not found</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const client = getClient(task.clientId);
  const project = getProject(task.projectId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const updatedTask = {
      ...task,
      description: formData.description,
      hours: formData.type !== 'insumos' ? (formData.hours ? Number(formData.hours) : undefined) : undefined,
      cost: formData.type === 'insumos' ? Number(formData.cost) : undefined,
      date: formData.date,
      type: formData.type,
      status: formData.status,
      priority: formData.priority,
      notes: formData.notes,
      finished: formData.type === 'insumos' ? true : (formData.hours ? true : formData.finished)
    };

    await updateTask(updatedTask);
    
    // Redirect to client dashboard if task is completed and has a client
    if (updatedTask.finished && task.clientId) {
      const client = getClient(task.clientId);
      if (client && client.slug) {
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        navigate(`/report/${client.slug}/${year}/${month}`);
        return;
      }
    }
    
    // Default redirect to dashboard
    navigate('/');
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      deleteTask(task.id);
      navigate('/');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6 dark:bg-gray-800">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-gray-100 rounded-lg dark:hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Task</h2>
          </div>
          <button
            onClick={handleDelete}
            className="inline-flex items-center px-3 py-2 border border-red-300 rounded-lg text-sm font-medium text-red-700 bg-white hover:bg-red-50 dark:border-red-600 dark:bg-gray-700 dark:text-red-400 dark:hover:bg-red-900/20 transition-all duration-200"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </button>
        </div>

        <div className="mb-6 p-4 bg-gray-50 rounded-lg dark:bg-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            <span className="font-medium">Client:</span> {client?.name}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            <span className="font-medium">Project:</span> {project?.name}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Task Type
            </label>
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
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Description
            </label>
            <textarea
              id="description"
              required
              rows={3}
              className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all duration-200"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the task..."
            />
          </div>

          {formData.type !== 'insumos' ? (
            <div>
              <label htmlFor="hours" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Hours {formData.finished ? '(completed)' : '(optional - leave empty to complete later)'}
              </label>
              <input
                type="number"
                id="hours"
                min="0.25"
                step="0.25"
                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all duration-200"
                value={formData.hours}
                onChange={(e) => setFormData(prev => ({ ...prev, hours: e.target.value }))}
                placeholder="Enter hours worked"
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {formData.finished 
                  ? 'This task is marked as completed'
                  : 'Leave empty to complete later from the dashboard'
                }
              </p>
            </div>
          ) : (
            <div>
              <label htmlFor="cost" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Cost
              </label>
              <div className="mt-1 relative rounded-lg shadow-sm">
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
                Date
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
                Priority
              </label>
              <select
                id="priority"
                required
                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all duration-200"
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as 'low' | 'medium' | 'high' }))}
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Status
            </label>
            <select
              id="status"
              required
              className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all duration-200"
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as 'not_started' | 'in_progress' | 'review' | 'completed' }))}
            >
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="review">Review</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Notes (optional)
            </label>
            <textarea
              id="notes"
              rows={3}
              className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all duration-200"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Add any additional notes..."
            />
          </div>

          <div className="flex justify-between pt-6">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-all duration-200"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center px-6 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-all duration-200 transform hover:scale-105"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}