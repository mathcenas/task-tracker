import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { BookTemplate as Template, Plus, X, Save, Trash2, Copy } from 'lucide-react';

interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  type: 'incident' | 'request' | 'insumos';
  priority: 'low' | 'medium' | 'high';
  estimatedHours?: number;
  estimatedCost?: number;
  category: string;
}

interface TaskTemplatesProps {
  isOpen: boolean;
  onClose: () => void;
  onUseTemplate: (template: TaskTemplate) => void;
}

export function TaskTemplates({ isOpen, onClose, onUseTemplate }: TaskTemplatesProps) {
  const [templates, setTemplates] = useState<TaskTemplate[]>(() => {
    const saved = localStorage.getItem('taskTemplates');
    return saved ? JSON.parse(saved) : [
      {
        id: '1',
        name: 'Server Monitoring Check',
        description: 'Monthly server performance and security monitoring',
        type: 'request',
        priority: 'medium',
        estimatedHours: 2,
        category: 'Maintenance'
      },
      {
        id: '2',
        name: 'Security Updates',
        description: 'Apply latest security patches and updates',
        type: 'request',
        priority: 'high',
        estimatedHours: 1.5,
        category: 'Security'
      },
      {
        id: '3',
        name: 'Backup Verification',
        description: 'Verify backup integrity and test restore procedures',
        type: 'request',
        priority: 'medium',
        estimatedHours: 1,
        category: 'Maintenance'
      },
      {
        id: '4',
        name: 'Website Down - Critical',
        description: 'Website is completely inaccessible - immediate investigation required',
        type: 'incident',
        priority: 'high',
        estimatedHours: 3,
        category: 'Critical Issues'
      },
      {
        id: '5',
        name: 'SSL Certificate Renewal',
        description: 'Renew and install SSL certificates',
        type: 'request',
        priority: 'medium',
        estimatedHours: 0.5,
        category: 'Security'
      },
      {
        id: '6',
        name: 'Database Optimization',
        description: 'Optimize database performance and clean up old data',
        type: 'request',
        priority: 'low',
        estimatedHours: 2.5,
        category: 'Performance'
      },
      {
        id: '7',
        name: 'Server Hardware',
        description: 'Additional RAM or storage upgrade',
        type: 'insumos',
        priority: 'medium',
        estimatedCost: 200,
        category: 'Hardware'
      }
    ];
  });

  const [isCreating, setIsCreating] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [newTemplate, setNewTemplate] = useState<Partial<TaskTemplate>>({
    name: '',
    description: '',
    type: 'request',
    priority: 'medium',
    category: 'General'
  });

  React.useEffect(() => {
    localStorage.setItem('taskTemplates', JSON.stringify(templates));
  }, [templates]);

  if (!isOpen) return null;

  const categories = [...new Set(templates.map(t => t.category))];

  const handleSaveTemplate = () => {
    if (!newTemplate.name || !newTemplate.description) return;

    const template: TaskTemplate = {
      id: editingTemplate?.id || crypto.randomUUID(),
      name: newTemplate.name!,
      description: newTemplate.description!,
      type: newTemplate.type!,
      priority: newTemplate.priority!,
      estimatedHours: newTemplate.estimatedHours,
      estimatedCost: newTemplate.estimatedCost,
      category: newTemplate.category!
    };

    if (editingTemplate) {
      setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? template : t));
    } else {
      setTemplates(prev => [...prev, template]);
    }

    setIsCreating(false);
    setEditingTemplate(null);
    setNewTemplate({
      name: '',
      description: '',
      type: 'request',
      priority: 'medium',
      category: 'General'
    });
  };

  const handleEditTemplate = (template: TaskTemplate) => {
    setEditingTemplate(template);
    setNewTemplate(template);
    setIsCreating(true);
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      setTemplates(prev => prev.filter(t => t.id !== templateId));
    }
  };

  const handleUseTemplate = (template: TaskTemplate) => {
    onUseTemplate(template);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/50 animate-overlayShow" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-contentShow">
        <div className="w-[90vw] max-w-4xl max-h-[80vh] rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
              <Template className="w-6 h-6 text-blue-500 mr-2" />
              Task Templates
            </h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsCreating(true)}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors"
              >
                <Plus className="w-4 h-4 mr-1" />
                New Template
              </button>
              <button
                onClick={onClose}
                className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[60vh]">
            {isCreating && (
              <div className="bg-blue-50 p-4 rounded-lg mb-6 dark:bg-blue-900/20">
                <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-4">
                  {editingTemplate ? 'Edit Template' : 'Create New Template'}
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Template Name
                    </label>
                    <input
                      type="text"
                      value={newTemplate.name || ''}
                      onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="e.g., Server Monitoring Check"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      value={newTemplate.category || ''}
                      onChange={(e) => setNewTemplate(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="e.g., Maintenance, Security"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={newTemplate.description || ''}
                      onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="Describe what this task involves..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Type
                    </label>
                    <select
                      value={newTemplate.type || 'request'}
                      onChange={(e) => setNewTemplate(prev => ({ ...prev, type: e.target.value as 'incident' | 'request' | 'insumos' }))}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="request">Request</option>
                      <option value="incident">Incident</option>
                      <option value="insumos">Supplies</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Priority
                    </label>
                    <select
                      value={newTemplate.priority || 'medium'}
                      onChange={(e) => setNewTemplate(prev => ({ ...prev, priority: e.target.value as 'low' | 'medium' | 'high' }))}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  
                  {newTemplate.type !== 'insumos' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Estimated Hours
                      </label>
                      <input
                        type="number"
                        min="0.25"
                        step="0.25"
                        value={newTemplate.estimatedHours || ''}
                        onChange={(e) => setNewTemplate(prev => ({ ...prev, estimatedHours: parseFloat(e.target.value) }))}
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        placeholder="2.0"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Estimated Cost
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={newTemplate.estimatedCost || ''}
                        onChange={(e) => setNewTemplate(prev => ({ ...prev, estimatedCost: parseFloat(e.target.value) }))}
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        placeholder="200.00"
                      />
                    </div>
                  )}
                </div>
                
                <div className="flex space-x-3 mt-4">
                  <button
                    onClick={handleSaveTemplate}
                    disabled={!newTemplate.name || !newTemplate.description}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {editingTemplate ? 'Update Template' : 'Save Template'}
                  </button>
                  <button
                    onClick={() => {
                      setIsCreating(false);
                      setEditingTemplate(null);
                      setNewTemplate({
                        name: '',
                        description: '',
                        type: 'request',
                        priority: 'medium',
                        category: 'General'
                      });
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {categories.map(category => (
              <div key={category} className="mb-6">
                <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                  {category}
                </h4>
                
                <div className="grid gap-3">
                  {templates
                    .filter(template => template.category === category)
                    .map(template => (
                    <div key={template.id} className="border rounded-lg p-4 hover:shadow-md transition-all dark:border-gray-700 group">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h5 className="font-medium text-gray-900 dark:text-white">{template.name}</h5>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              template.type === 'incident' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                              template.type === 'insumos' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                              'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            }`}>
                              {template.type}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              template.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                              template.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                              'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            }`}>
                              {template.priority}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{template.description}</p>
                          <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                            {template.estimatedHours && (
                              <span>Est. {template.estimatedHours}h</span>
                            )}
                            {template.estimatedCost && (
                              <span>Est. ${template.estimatedCost}</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleUseTemplate(template)}
                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            Use
                          </button>
                          <button
                            onClick={() => handleEditTemplate(template)}
                            className="p-1.5 hover:bg-gray-100 rounded dark:hover:bg-gray-700 transition-colors"
                            title="Edit template"
                          >
                            <Template className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="p-1.5 hover:bg-gray-100 rounded dark:hover:bg-gray-700 transition-colors"
                            title="Delete template"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}