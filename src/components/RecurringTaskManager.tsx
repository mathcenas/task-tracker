import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Repeat, Plus, X, Save, Trash2, Calendar, Clock, AlertTriangle } from 'lucide-react';
import { format, addMonths, startOfMonth, isBefore, isAfter } from 'date-fns';

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
  recurringWeekend?: boolean;
  recurringWeekendType?: 'first' | 'second' | 'third' | 'fourth' | 'last';
  recurringWeekendDay?: 'saturday' | 'sunday';
  recurringEndDate?: string;
}

interface RecurringTaskManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RecurringTaskManager({ isOpen, onClose }: RecurringTaskManagerProps) {
  const { clients, projects, getClientProjects, addTask } = useApp();
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>(() => {
    const saved = localStorage.getItem('recurringTasks');
    return saved ? JSON.parse(saved) : [
      {
        id: '1',
        name: 'Monthly Server Monitoring',
        description: 'Comprehensive server performance and security check',
        type: 'request',
        priority: 'medium',
        clientId: clients[0]?.id || '',
        projectId: '',
        dayOfMonth: 1,
        estimatedHours: 2,
        isActive: true,
        nextDue: format(addMonths(startOfMonth(new Date()), 1), 'yyyy-MM-dd')
      },
      {
        id: '2',
        name: 'Security Updates',
        description: 'Apply latest security patches and system updates',
        type: 'request',
        priority: 'high',
        clientId: clients[0]?.id || '',
        projectId: '',
        dayOfMonth: 15,
        estimatedHours: 1.5,
        isActive: true,
        nextDue: format(new Date(new Date().getFullYear(), new Date().getMonth(), 15), 'yyyy-MM-dd')
      },
      {
        id: '3',
        name: 'Backup Verification',
        description: 'Verify backup integrity and test restore procedures',
        type: 'request',
        priority: 'medium',
        clientId: clients[0]?.id || '',
        projectId: '',
        dayOfMonth: 28,
        estimatedHours: 1,
        isActive: true,
        nextDue: format(new Date(new Date().getFullYear(), new Date().getMonth(), 28), 'yyyy-MM-dd'),
        recurringWeekend: false
      }
    ];
  });

  const [isCreating, setIsCreating] = useState(false);
  const [editingTask, setEditingTask] = useState<RecurringTask | null>(null);
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
    recurringEndDate: ''
  });

  useEffect(() => {
    localStorage.setItem('recurringTasks', JSON.stringify(recurringTasks));
  }, [recurringTasks]);

  // Auto-generate overdue recurring tasks
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time for accurate date comparison
    
    // Helper function to calculate next weekend date
    const getNextWeekendDate = (weekendType: string, weekendDay: string, baseDate: Date) => {
      const year = baseDate.getFullYear();
      const month = baseDate.getMonth();
      const lastDay = new Date(year, month + 1, 0);
      
      const targetDay = weekendDay === 'saturday' ? 6 : 0; // 6 = Saturday, 0 = Sunday
      const weekends = [];
      
      // Find all weekends in the month
      for (let date = 1; date <= lastDay.getDate(); date++) {
        const currentDate = new Date(year, month, date);
        if (currentDate.getDay() === targetDay) {
          weekends.push(date);
        }
      }
      
      if (weekends.length === 0) return null;
      
      let targetDate;
      switch (weekendType) {
        case 'first':
          targetDate = weekends[0];
          break;
        case 'second':
          targetDate = weekends[1];
          break;
        case 'third':
          targetDate = weekends[2];
          break;
        case 'fourth':
          targetDate = weekends[3];
          break;
        case 'last':
          targetDate = weekends[weekends.length - 1];
          break;
        default:
          targetDate = weekends[0];
      }
      
      return targetDate ? new Date(year, month, targetDate) : null;
    };
    
    const tasksToGenerate = recurringTasks.filter(task => {
      if (!task.isActive) return false;
      
      const nextDueDate = new Date(task.nextDue);
      nextDueDate.setHours(0, 0, 0, 0);
      
      // Check if task is overdue
      const isOverdue = isBefore(nextDueDate, today) || nextDueDate.getTime() === today.getTime();
      
      // Check if task has expired (past end date)
      if (task.recurringEndDate) {
        const endDate = new Date(task.recurringEndDate);
        endDate.setHours(23, 59, 59, 999);
        if (isAfter(today, endDate)) {
          return false;
        }
      }
      
      return isOverdue;
    });

    console.log('Checking recurring tasks:', {
      today: today.toISOString().split('T')[0],
      totalRecurringTasks: recurringTasks.length,
      activeRecurringTasks: recurringTasks.filter(t => t.isActive).length,
      tasksToGenerate: tasksToGenerate.length,
      tasksDetails: tasksToGenerate.map(t => ({
        name: t.name,
        nextDue: t.nextDue,
        recurringWeekend: t.recurringWeekend,
        recurringWeekendType: t.recurringWeekendType,
        recurringWeekendDay: t.recurringWeekendDay
      }))
    });

    tasksToGenerate.forEach(recurringTask => {
      // Generate the actual task
      const taskData = {
        clientId: recurringTask.clientId,
        projectId: recurringTask.projectId,
        description: `[Recurring] ${recurringTask.description}`,
        hours: recurringTask.estimatedHours,
        cost: recurringTask.estimatedCost,
        date: recurringTask.nextDue,
        type: recurringTask.type,
        status: 'pending' as const,
        priority: recurringTask.priority,
        finished: false,
        isRecurring: true,
        recurringWeekend: recurringTask.recurringWeekend,
        recurringWeekendType: recurringTask.recurringWeekendType,
        recurringWeekendDay: recurringTask.recurringWeekendDay,
        notes: `Auto-generated from recurring task: ${recurringTask.name}`
      };

      addTask(taskData);

      // Update the recurring task's next due date
      const currentDate = new Date(recurringTask.nextDue);
      const nextMonth = addMonths(currentDate, 1);
      
      let nextDue;
      if (recurringTask.recurringWeekend) {
        const nextWeekendDate = getNextWeekendDate(
          recurringTask.recurringWeekendType || 'first',
          recurringTask.recurringWeekendDay || 'saturday',
          nextMonth
        );
        if (nextWeekendDate) {
          nextDue = format(nextWeekendDate, 'yyyy-MM-dd');
        } else {
          // If no weekend found, try next month
          const nextNextMonth = addMonths(nextMonth, 1);
          const fallbackWeekendDate = getNextWeekendDate(
            recurringTask.recurringWeekendType || 'first',
            recurringTask.recurringWeekendDay || 'saturday',
            nextNextMonth
          );
          nextDue = fallbackWeekendDate ? format(fallbackWeekendDate, 'yyyy-MM-dd') : format(nextNextMonth, 'yyyy-MM-dd');
        }
      } else {
        const targetDay = Math.min(recurringTask.dayOfMonth, new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate());
        nextDue = format(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), targetDay), 'yyyy-MM-dd');
      }

      console.log('Updating recurring task:', {
        name: recurringTask.name,
        oldNextDue: recurringTask.nextDue,
        newNextDue: nextDue,
        recurringWeekend: recurringTask.recurringWeekend
      });

      setRecurringTasks(prev => prev.map(task => 
        task.id === recurringTask.id 
          ? { ...task, lastGenerated: recurringTask.nextDue, nextDue }
          : task
      ));
    });
  }, [recurringTasks, addTask]);

  if (!isOpen) return null;

  const handleSaveTask = () => {
    if (!newTask.name || !newTask.description || !newTask.clientId) return;

    // Helper function to calculate next weekend date
    const getNextWeekendDate = (weekendType: string, weekendDay: string, baseDate: Date) => {
      const year = baseDate.getFullYear();
      const month = baseDate.getMonth();
      const targetDay = weekendDay === 'saturday' ? 6 : 0;
      const weekends = [];
      
      const lastDay = new Date(year, month + 1, 0);
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
      
      return targetDate ? new Date(year, month, targetDate) : null;
    };

    let nextDue;
    const nextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
    
    if (newTask.recurringWeekend) {
      const nextWeekendDate = getNextWeekendDate(
        newTask.recurringWeekendType || 'first',
        newTask.recurringWeekendDay || 'saturday',
        nextMonth
      );
      nextDue = nextWeekendDate ? format(nextWeekendDate, 'yyyy-MM-dd') : format(nextMonth, 'yyyy-MM-dd');
    } else {
      nextDue = format(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), newTask.dayOfMonth!), 'yyyy-MM-dd');
    }

    const task: RecurringTask = {
      id: editingTask?.id || crypto.randomUUID(),
      name: newTask.name!,
      description: newTask.description!,
      type: newTask.type!,
      priority: newTask.priority!,
      clientId: newTask.clientId!,
      projectId: newTask.projectId!,
      dayOfMonth: newTask.dayOfMonth!,
      estimatedHours: newTask.estimatedHours,
      estimatedCost: newTask.estimatedCost,
      isActive: newTask.isActive!,
      nextDue: editingTask?.nextDue || nextDue,
      recurringWeekend: newTask.recurringWeekend,
      recurringWeekendType: newTask.recurringWeekendType,
      recurringWeekendDay: newTask.recurringWeekendDay,
      recurringEndDate: newTask.recurringEndDate
    };

    if (editingTask) {
      setRecurringTasks(prev => prev.map(t => t.id === editingTask.id ? task : t));
    } else {
      setRecurringTasks(prev => [...prev, task]);
    }

    setIsCreating(false);
    setEditingTask(null);
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
      recurringEndDate: ''
    });
  };

  const handleEditTask = (task: RecurringTask) => {
    setEditingTask(task);
    setNewTask(task);
    setIsCreating(true);
  };

  const handleDeleteTask = (taskId: string) => {
    if (window.confirm('Are you sure you want to delete this recurring task?')) {
      setRecurringTasks(prev => prev.filter(t => t.id !== taskId));
    }
  };

  const handleToggleActive = (taskId: string) => {
    setRecurringTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, isActive: !task.isActive } : task
    ));
  };

  const clientProjects = newTask.clientId ? getClientProjects(newTask.clientId) : [];
  const overdueTasks = recurringTasks.filter(task => 
    task.isActive && isBefore(new Date(task.nextDue), new Date())
  );

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/50 animate-overlayShow" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-contentShow">
        <div className="w-[90vw] max-w-4xl max-h-[80vh] rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
              <Repeat className="w-6 h-6 text-blue-500 mr-2" />
              Recurring Tasks Manager
            </h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsCreating(true)}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors"
              >
                <Plus className="w-4 h-4 mr-1" />
                New Recurring Task
              </button>
              <button
                onClick={onClose}
                className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {overdueTasks.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 dark:bg-yellow-900/20 dark:border-yellow-800">
              <div className="flex items-center mb-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
                <h4 className="font-medium text-yellow-800 dark:text-yellow-300">
                  {overdueTasks.length} Recurring Task{overdueTasks.length > 1 ? 's' : ''} Generated
                </h4>
              </div>
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                Overdue recurring tasks have been automatically added to your task list.
              </p>
            </div>
          )}

          <div className="overflow-y-auto max-h-[60vh]">
            {isCreating && (
              <div className="bg-blue-50 p-4 rounded-lg mb-6 dark:bg-blue-900/20">
                <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-4">
                  {editingTask ? 'Edit Recurring Task' : 'Create New Recurring Task'}
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Task Name
                    </label>
                    <input
                      type="text"
                      value={newTask.name || ''}
                      onChange={(e) => setNewTask(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="e.g., Monthly Server Monitoring"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Recurrence Schedule
                    </label>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="recurringType"
                            checked={!newTask.recurringWeekend}
                            onChange={() => setNewTask(prev => ({ ...prev, recurringWeekend: false }))}
                            className="form-radio text-blue-600"
                          />
                          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Specific day of month</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="recurringType"
                            checked={newTask.recurringWeekend}
                            onChange={() => setNewTask(prev => ({ ...prev, recurringWeekend: true }))}
                            className="form-radio text-blue-600"
                          />
                          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Weekend of month</span>
                        </label>
                      </div>
                      
                      {!newTask.recurringWeekend ? (
                        <div>
                          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Day of Month
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="31"
                            value={newTask.dayOfMonth || 1}
                            onChange={(e) => setNewTask(prev => ({ ...prev, dayOfMonth: parseInt(e.target.value) }))}
                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div>
                            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                              Which Weekend
                            </label>
                            <select
                              value={newTask.recurringWeekendType || 'first'}
                              onChange={(e) => setNewTask(prev => ({ ...prev, recurringWeekendType: e.target.value as 'first' | 'second' | 'third' | 'fourth' | 'last' }))}
                              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            >
                              <option value="first">First weekend</option>
                              <option value="second">Second weekend</option>
                              <option value="third">Third weekend</option>
                              <option value="fourth">Fourth weekend</option>
                              <option value="last">Last weekend</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                              Weekend Day
                            </label>
                            <select
                              value={newTask.recurringWeekendDay || 'saturday'}
                              onChange={(e) => setNewTask(prev => ({ ...prev, recurringWeekendDay: e.target.value as 'saturday' | 'sunday' }))}
                              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            >
                              <option value="saturday">Saturday</option>
                              <option value="sunday">Sunday</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={newTask.description || ''}
                      onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="Describe what this recurring task involves..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Client
                    </label>
                    <select
                      value={newTask.clientId || ''}
                      onChange={(e) => setNewTask(prev => ({ ...prev, clientId: e.target.value, projectId: '' }))}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="">Select a client</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>{client.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Project
                    </label>
                    <select
                      value={newTask.projectId || ''}
                      onChange={(e) => setNewTask(prev => ({ ...prev, projectId: e.target.value }))}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      disabled={!newTask.clientId}
                    >
                      <option value="">Select a project</option>
                      {clientProjects.map(project => (
                        <option key={project.id} value={project.id}>{project.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Type
                    </label>
                    <select
                      value={newTask.type || 'request'}
                      onChange={(e) => setNewTask(prev => ({ ...prev, type: e.target.value as 'incident' | 'request' | 'insumos' }))}
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
                      value={newTask.priority || 'medium'}
                      onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value as 'low' | 'medium' | 'high' }))}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  
                  {newTask.type !== 'insumos' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Estimated Hours
                      </label>
                      <input
                        type="number"
                        min="0.25"
                        step="0.25"
                        value={newTask.estimatedHours || ''}
                        onChange={(e) => setNewTask(prev => ({ ...prev, estimatedHours: parseFloat(e.target.value) }))}
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
                        value={newTask.estimatedCost || ''}
                        onChange={(e) => setNewTask(prev => ({ ...prev, estimatedCost: parseFloat(e.target.value) }))}
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        placeholder="200.00"
                      />
                    </div>
                  )}
                </div>
                
                <div className="flex space-x-3 mt-4">
                  <button
                    onClick={handleSaveTask}
                    disabled={!newTask.name || !newTask.description || !newTask.clientId}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {editingTask ? 'Update Task' : 'Save Task'}
                  </button>
                  <button
                    onClick={() => {
                      setIsCreating(false);
                      setEditingTask(null);
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
                        recurringWeekendDay: 'saturday'
                      });
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {recurringTasks.map(task => {
                const client = clients.find(c => c.id === task.clientId);
                const project = projects.find(p => p.id === task.projectId);
                const isOverdue = isBefore(new Date(task.nextDue), new Date());
                
                return (
                  <div key={task.id} className={`border rounded-lg p-4 transition-all ${
                    task.isActive 
                      ? 'hover:shadow-md dark:border-gray-700' 
                      : 'opacity-60 border-gray-200 dark:border-gray-600'
                  }`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h5 className="font-medium text-gray-900 dark:text-white">{task.name}</h5>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            task.type === 'incident' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                            task.type === 'insumos' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                            'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          }`}>
                            {task.type}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            task.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                            task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                            'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          }`}>
                            {task.priority}
                          </span>
                          {!task.isActive && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                              Inactive
                            </span>
                          )}
                          {isOverdue && task.isActive && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                              Generated
                            </span>
                          )}
                        </div>
                        
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{task.description}</p>
                        
                        <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            {task.recurringWeekend 
                              ? `${task.recurringWeekendType} ${task.recurringWeekendDay} of each month`
                              : `Day ${task.dayOfMonth} of each month`
                            }
                          </span>
                          <span>{client?.name} • {project?.name}</span>
                          {task.estimatedHours && (
                            <span className="flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {task.estimatedHours}h
                            </span>
                          )}
                          {task.estimatedCost && (
                            <span>${task.estimatedCost}</span>
                          )}
                        </div>
                        
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          Next due: {format(new Date(task.nextDue), 'MMM d, yyyy')}
                          {task.lastGenerated && (
                            <span className="ml-2">• Last generated: {format(new Date(task.lastGenerated), 'MMM d, yyyy')}</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleToggleActive(task.id)}
                          className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                            task.isActive
                              ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200'
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200'
                          }`}
                        >
                          {task.isActive ? 'Active' : 'Inactive'}
                        </button>
                        <button
                          onClick={() => handleEditTask(task)}
                          className="p-1.5 hover:bg-gray-100 rounded dark:hover:bg-gray-700 transition-colors"
                          title="Edit recurring task"
                        >
                          <Repeat className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        </button>
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-1.5 hover:bg-gray-100 rounded dark:hover:bg-gray-700 transition-colors"
                          title="Delete recurring task"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {recurringTasks.length === 0 && (
                <div className="text-center py-8">
                  <Repeat className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">No recurring tasks configured</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                    Create recurring tasks for regular maintenance and monitoring
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}