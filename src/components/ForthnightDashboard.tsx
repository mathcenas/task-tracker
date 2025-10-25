import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { parseISO, format, isWithinInterval, subDays } from 'date-fns';
import { AlertTriangle, FileText, CheckCircle, Package, Clock, Calendar, TrendingUp, Plus, Pencil, Folder, Users, Target, Zap, X, BarChart3, DollarSign, CheckSquare, BookTemplate as Template, Repeat, CalendarDays } from 'lucide-react';
import { CompletionModal } from './CompletionModal';
import { BulkTaskOperations } from './BulkTaskOperations';
import { TaskTemplates } from './TaskTemplates';
import { RecurringTaskManager } from './RecurringTaskManager';
import { CalendarSync } from './CalendarSync';
import { Link } from 'react-router-dom';

export function ForthnightDashboard() {
  const { tasks, projects, getClient, getProject, finishTask, updateTask, getProjectTasks } = useApp();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<'hours' | 'revenue' | 'pending' | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [showBulkOperations, setShowBulkOperations] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showRecurringTasks, setShowRecurringTasks] = useState(false);
  const [showCalendarSync, setShowCalendarSync] = useState(false);

  const today = new Date();
  const forthnightStart = subDays(today, 15);

  const forthnightTasks = tasks.filter(task => {
    const taskDate = parseISO(task.date + 'T00:00:00');
    return isWithinInterval(taskDate, { start: forthnightStart, end: today });
  });

  const completedForthnightTasks = forthnightTasks.filter(t => t.finished);
  const unfinishedTasks = forthnightTasks.filter(task => !task.finished);

  // Categorize unfinished tasks
  const overdueTasks = unfinishedTasks.filter(task => {
    const taskDate = parseISO(task.date + 'T00:00:00');
    taskDate.setHours(0, 0, 0, 0);
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    return taskDate < todayDate;
  });

  const todayTasks = unfinishedTasks.filter(task => {
    const taskDate = parseISO(task.date + 'T00:00:00');
    return format(taskDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
  });

  const upcomingTasks = unfinishedTasks.filter(task => {
    const taskDate = parseISO(task.date + 'T00:00:00');
    taskDate.setHours(0, 0, 0, 0);
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    return taskDate > todayDate;
  });

  const completionRate = forthnightTasks.length > 0 ? (completedForthnightTasks.length / forthnightTasks.length) * 100 : 0;

  // Get active projects with their stats
  const activeProjects = projects
    .filter(project => project.status === 'active')
    .map(project => {
      const projectTasks = getProjectTasks(project.id).filter(t => {
        const taskDate = parseISO(t.date + 'T00:00:00');
        return isWithinInterval(taskDate, { start: forthnightStart, end: today });
      });
      const completedTasks = projectTasks.filter(t => t.finished).length;
      const pendingTasks = projectTasks.filter(t => !t.finished).length;
      const totalHours = projectTasks
        .filter(t => t.finished && t.type !== 'insumos')
        .reduce((sum, task) => sum + (task.hours || 0), 0);
      const client = getClient(project.clientId);

      return {
        ...project,
        client,
        totalTasks: projectTasks.length,
        completedTasks,
        pendingTasks,
        totalHours,
        revenue: totalHours * (client?.hourlyRate || 0)
      };
    })
    .filter(p => p.totalTasks > 0)
    .sort((a, b) => b.pendingTasks - a.pendingTasks);

  const totalHours = completedForthnightTasks
    .filter(task => task.type !== 'insumos')
    .reduce((sum, task) => sum + (task.hours || 0), 0);

  const totalRevenue = completedForthnightTasks.reduce((sum, task) => {
    if (task.type === 'insumos') {
      return sum - (task.cost || 0);
    }
    const client = getClient(task.clientId);
    return sum + ((task.hours || 0) * (client?.hourlyRate || 0));
  }, 0);

  const handleMarkAsComplete = (taskId: string) => {
    setSelectedTaskId(taskId);
    setIsModalOpen(true);
  };

  const handleConfirmCompletion = (data: { hours: number; cost: number; status: string; notes: string }) => {
    if (selectedTaskId) {
      finishTask(selectedTaskId, data.hours, data.cost, data.status, data.notes);
    }
    setIsModalOpen(false);
    setSelectedTaskId(null);
  };

  const handleCardClick = (card: 'hours' | 'revenue' | 'pending') => {
    if (selectedCard === card) {
      setSelectedCard(null);
    } else {
      setSelectedCard(card);
    }
  };

  const getFilteredTasks = () => {
    if (!selectedCard) return [];

    switch (selectedCard) {
      case 'hours':
        return completedForthnightTasks.filter(t => (t.hours || 0) > 0 && t.type !== 'insumos');
      case 'revenue':
        return completedForthnightTasks;
      case 'pending':
        return unfinishedTasks;
      default:
        return [];
    }
  };

  const handleTaskCheckboxChange = (taskId: string, checked: boolean) => {
    if (checked) {
      setSelectedTasks([...selectedTasks, taskId]);
    } else {
      setSelectedTasks(selectedTasks.filter(id => id !== taskId));
    }
  };

  const handleSelectAllTasks = (taskList: typeof tasks) => {
    const taskIds = taskList.map(t => t.id);
    const allSelected = taskIds.every(id => selectedTasks.includes(id));

    if (allSelected) {
      setSelectedTasks(selectedTasks.filter(id => !taskIds.includes(id)));
    } else {
      setSelectedTasks([...new Set([...selectedTasks, ...taskIds])]);
    }
  };

  const renderTaskCard = (task: typeof tasks[0], showCheckbox = false) => {
    const client = getClient(task.clientId);
    const project = getProject(task.projectId);
    const taskDate = parseISO(task.date + 'T00:00:00');
    const isOverdue = !task.finished && taskDate < new Date();
    const isChecked = selectedTasks.includes(task.id);

    return (
      <div
        key={task.id}
        className={`p-4 rounded-lg transition-all ${
          isOverdue
            ? 'bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800'
            : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {showCheckbox && (
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => handleTaskCheckboxChange(task.id, e.target.checked)}
                className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-medium ${
                  isOverdue ? 'text-red-900 dark:text-red-200' : 'text-gray-900 dark:text-white'
                }`}>
                  {client?.name}
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  {project?.name}
                </span>
                {task.priority !== 'medium' && (
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    task.priority === 'high'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {task.priority}
                  </span>
                )}
              </div>
              <p className={`text-sm mt-1 ${
                isOverdue ? 'text-red-800 dark:text-red-300' : 'text-gray-600 dark:text-gray-300'
              }`}>
                {task.description}
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(taskDate, 'MMM d, yyyy')}
                </span>
                {task.hours !== undefined && task.hours > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {task.hours}h
                  </span>
                )}
                {task.cost !== undefined && task.cost > 0 && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    ${task.cost.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            {!task.finished && (
              <>
                <Link to={`/edit-task/${task.id}`}>
                  <button className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors">
                    <Pencil className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  </button>
                </Link>
                <button
                  onClick={() => handleMarkAsComplete(task.id)}
                  className="p-2 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                >
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Last 15 Days</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCalendarSync(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <CalendarDays className="w-4 h-4" />
              Calendar Sync
            </button>
            <button
              onClick={() => setShowRecurringTasks(true)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              <Repeat className="w-4 h-4" />
              Recurring Tasks
            </button>
            <button
              onClick={() => setShowTemplates(true)}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
            >
              <Template className="w-4 h-4" />
              Templates
            </button>
            <Link to="/task/new">
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <Plus className="w-4 h-4" />
                New Task
              </button>
            </Link>
          </div>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          {format(forthnightStart, 'MMM d')} - {format(today, 'MMM d, yyyy')}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <button
          onClick={() => handleCardClick('hours')}
          className={`text-left p-6 rounded-lg shadow transition-all ${
            selectedCard === 'hours'
              ? 'bg-blue-600 text-white transform scale-105'
              : 'bg-white dark:bg-gray-800 hover:shadow-lg'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className={`p-3 rounded-lg ${
              selectedCard === 'hours' ? 'bg-blue-500' : 'bg-blue-100 dark:bg-blue-900/30'
            }`}>
              <Clock className={`w-6 h-6 ${
                selectedCard === 'hours' ? 'text-white' : 'text-blue-600 dark:text-blue-400'
              }`} />
            </div>
            <BarChart3 className={`w-5 h-5 ${
              selectedCard === 'hours' ? 'text-blue-200' : 'text-gray-400'
            }`} />
          </div>
          <h3 className={`text-sm font-medium mb-1 ${
            selectedCard === 'hours' ? 'text-blue-100' : 'text-gray-600 dark:text-gray-400'
          }`}>
            Total Hours (Completed)
          </h3>
          <p className={`text-3xl font-bold ${
            selectedCard === 'hours' ? 'text-white' : 'text-gray-900 dark:text-white'
          }`}>
            {totalHours.toFixed(1)}
          </p>
        </button>

        <button
          onClick={() => handleCardClick('revenue')}
          className={`text-left p-6 rounded-lg shadow transition-all ${
            selectedCard === 'revenue'
              ? 'bg-green-600 text-white transform scale-105'
              : 'bg-white dark:bg-gray-800 hover:shadow-lg'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className={`p-3 rounded-lg ${
              selectedCard === 'revenue' ? 'bg-green-500' : 'bg-green-100 dark:bg-green-900/30'
            }`}>
              <DollarSign className={`w-6 h-6 ${
                selectedCard === 'revenue' ? 'text-white' : 'text-green-600 dark:text-green-400'
              }`} />
            </div>
            <TrendingUp className={`w-5 h-5 ${
              selectedCard === 'revenue' ? 'text-green-200' : 'text-gray-400'
            }`} />
          </div>
          <h3 className={`text-sm font-medium mb-1 ${
            selectedCard === 'revenue' ? 'text-green-100' : 'text-gray-600 dark:text-gray-400'
          }`}>
            Total Revenue (Completed)
          </h3>
          <p className={`text-3xl font-bold ${
            selectedCard === 'revenue' ? 'text-white' : 'text-gray-900 dark:text-white'
          }`}>
            ${totalRevenue.toFixed(2)}
          </p>
        </button>

        <button
          onClick={() => handleCardClick('pending')}
          className={`text-left p-6 rounded-lg shadow transition-all ${
            selectedCard === 'pending'
              ? 'bg-orange-600 text-white transform scale-105'
              : 'bg-white dark:bg-gray-800 hover:shadow-lg'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className={`p-3 rounded-lg ${
              selectedCard === 'pending' ? 'bg-orange-500' : 'bg-orange-100 dark:bg-orange-900/30'
            }`}>
              <AlertTriangle className={`w-6 h-6 ${
                selectedCard === 'pending' ? 'text-white' : 'text-orange-600 dark:text-orange-400'
              }`} />
            </div>
            <Target className={`w-5 h-5 ${
              selectedCard === 'pending' ? 'text-orange-200' : 'text-gray-400'
            }`} />
          </div>
          <h3 className={`text-sm font-medium mb-1 ${
            selectedCard === 'pending' ? 'text-orange-100' : 'text-gray-600 dark:text-gray-400'
          }`}>
            Pending Tasks
          </h3>
          <p className={`text-3xl font-bold ${
            selectedCard === 'pending' ? 'text-white' : 'text-gray-900 dark:text-white'
          }`}>
            {unfinishedTasks.length}
          </p>
          <p className={`text-sm mt-1 ${
            selectedCard === 'pending' ? 'text-orange-100' : 'text-gray-500 dark:text-gray-400'
          }`}>
            {completionRate.toFixed(0)}% completed
          </p>
        </button>
      </div>

      {/* Filtered Tasks Section */}
      {selectedCard && (
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              {selectedCard === 'hours' && <><Clock className="w-5 h-5 text-blue-600" /> Tasks with Hours</>}
              {selectedCard === 'revenue' && <><DollarSign className="w-5 h-5 text-green-600" /> Revenue Tasks</>}
              {selectedCard === 'pending' && <><AlertTriangle className="w-5 h-5 text-orange-600" /> Pending Tasks</>}
            </h2>
            <button
              onClick={() => setSelectedCard(null)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <div className="space-y-3">
            {getFilteredTasks().length > 0 ? (
              <>
                {selectedCard === 'pending' && (
                  <div className="flex items-center justify-between pb-3 border-b dark:border-gray-700">
                    <button
                      onClick={() => handleSelectAllTasks(getFilteredTasks())}
                      className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      {getFilteredTasks().every(t => selectedTasks.includes(t.id)) ? 'Deselect All' : 'Select All'}
                    </button>
                    {selectedTasks.length > 0 && (
                      <button
                        onClick={() => setShowBulkOperations(true)}
                        className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Bulk Actions ({selectedTasks.length})
                      </button>
                    )}
                  </div>
                )}
                {getFilteredTasks().map(task => renderTaskCard(task, selectedCard === 'pending'))}
              </>
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">No tasks found</p>
            )}
          </div>
        </div>
      )}

      {/* Active Projects */}
      {activeProjects.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Folder className="w-5 h-5 text-blue-600" />
            Active Projects ({activeProjects.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeProjects.map(project => (
              <div key={project.id} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{project.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{project.client?.name}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    project.pendingTasks > 0
                      ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  }`}>
                    {project.pendingTasks} pending
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm mt-3">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Tasks</p>
                    <p className="font-medium text-gray-900 dark:text-white">{project.totalTasks}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Hours</p>
                    <p className="font-medium text-gray-900 dark:text-white">{project.totalHours.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Revenue</p>
                    <p className="font-medium text-gray-900 dark:text-white">${project.revenue.toFixed(0)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Tasks by Priority */}
      {unfinishedTasks.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Overdue */}
          {overdueTasks.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Overdue ({overdueTasks.length})
              </h2>
              <div className="space-y-3">
                {overdueTasks.map(task => renderTaskCard(task))}
              </div>
            </div>
          )}

          {/* Today */}
          {todayTasks.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-blue-700 dark:text-blue-400 mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Today ({todayTasks.length})
              </h2>
              <div className="space-y-3">
                {todayTasks.map(task => renderTaskCard(task))}
              </div>
            </div>
          )}

          {/* Recent */}
          {upcomingTasks.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-400 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Recent ({upcomingTasks.length})
              </h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {upcomingTasks.slice(0, 10).map(task => renderTaskCard(task))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {isModalOpen && selectedTaskId && (
        <CompletionModal
          task={tasks.find(t => t.id === selectedTaskId)!}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedTaskId(null);
          }}
          onConfirm={handleConfirmCompletion}
        />
      )}

      {showBulkOperations && (
        <BulkTaskOperations
          selectedTaskIds={selectedTasks}
          onClose={() => {
            setShowBulkOperations(false);
            setSelectedTasks([]);
          }}
        />
      )}

      {showTemplates && (
        <TaskTemplates onClose={() => setShowTemplates(false)} />
      )}

      {showRecurringTasks && (
        <RecurringTaskManager onClose={() => setShowRecurringTasks(false)} />
      )}

      {showCalendarSync && (
        <CalendarSync onClose={() => setShowCalendarSync(false)} />
      )}
    </div>
  );
}
