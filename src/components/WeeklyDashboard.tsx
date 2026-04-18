import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { startOfWeek, endOfWeek, parseISO, format, isToday, isTomorrow, isYesterday, isThisWeek } from 'date-fns';
import { AlertTriangle, FileText, CheckCircle, Package, Clock, Calendar, TrendingUp, Plus, Pencil, Folder, Users, Target, Zap, X, BarChart3, DollarSign, CheckSquare, LayoutTemplate as Template, Repeat, CalendarDays, Download } from 'lucide-react';
import { CompletionModal } from './CompletionModal';
import { BulkTaskOperations } from './BulkTaskOperations';
import { TaskTemplates } from './TaskTemplates';
import { RecurringTaskManager } from './RecurringTaskManager';
import { CalendarSync } from './CalendarSync';
import { TaskFilters } from './ui/TaskFilters';
import { TaskStatusBadge } from './TaskStatusBadge';
import { Link } from 'react-router-dom';
import { exportTasksToCSV } from '../utils/csvExport';

export function WeeklyDashboard() {
  const { tasks, projects, getClient, getProject, finishTask, updateTask, getProjectTasks } = useApp();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<'hours' | 'revenue' | 'pending' | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [showBulkOperations, setShowBulkOperations] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showRecurringTasks, setShowRecurringTasks] = useState(false);
  const [showCalendarSync, setShowCalendarSync] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [taskFilter, setTaskFilter] = useState<'all' | 'overdue' | 'today' | 'upcoming' | 'completed' | 'in_progress' | 'not_started'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'incident' | 'request' | 'insumos'>('all');

  // Force refresh when tasks change
  React.useEffect(() => {
    setRefreshKey(prev => prev + 1);
  }, [tasks.length]);

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Start week on Monday
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  const weeklyTasks = tasks.filter(task => {
    const taskDate = parseISO(task.date + 'T00:00:00'); // Ensure consistent timezone handling
    return taskDate >= weekStart && taskDate <= weekEnd && task.finished;
  });
  
  console.log('📅 Weekly Dashboard - filtering for week:', {
    weekStart: format(weekStart, 'yyyy-MM-dd'),
    weekEnd: format(weekEnd, 'yyyy-MM-dd'),
    totalTasks: tasks.length,
    completedTasks: tasks.filter(t => t.finished).length,
    weeklyTasks: weeklyTasks.length
  });

  // Show ALL unfinished tasks regardless of date
  const allUnfinishedTasks = tasks.filter(task => !task.finished);

  // Categorize unfinished tasks
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

  // Apply filters
  let filteredTasks = [...tasks];

  // Status filter
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

  // Priority filter
  if (priorityFilter !== 'all') {
    filteredTasks = filteredTasks.filter(task => task.priority === priorityFilter);
  }

  // Type filter
  if (typeFilter !== 'all') {
    filteredTasks = filteredTasks.filter(task => task.type === typeFilter);
  }

  const unfinishedTasks = filteredTasks.filter(task => !task.finished);
  
  // Quick stats
  const thisWeekTasks = tasks.filter(task => isThisWeek(parseISO(task.date + 'T00:00:00'), { weekStartsOn: 1 }));
  const completionRate = thisWeekTasks.length > 0 ? (weeklyTasks.length / thisWeekTasks.length) * 100 : 0;
  
  // Get active projects with their stats
  const activeProjects = projects
    .filter(project => project.status === 'active')
    .map(project => {
      const projectTasks = getProjectTasks(project.id);
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
    .sort((a, b) => b.pendingTasks - a.pendingTasks); // Sort by pending tasks (most active first)

  const totalHours = weeklyTasks
    .filter(task => task.type !== 'insumos')
    .reduce((sum, task) => sum + (task.hours || 0), 0);

  const totalRevenue = weeklyTasks.reduce((sum, task) => {
    if (task.type === 'insumos') {
      return sum - (task.cost || 0);
    }
    const client = getClient(task.clientId);
    return sum + ((task.hours || 0) * (client?.hourlyRate || 0));
  }, 0);

  const getRelativeDate = (date: string) => {
    const taskDate = new Date(date);
    if (isToday(taskDate)) return 'Today';
    if (isTomorrow(taskDate)) return 'Tomorrow';
    if (isYesterday(taskDate)) return 'Yesterday';
    return format(taskDate, 'MMM d');
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-l-red-500 bg-red-50 dark:bg-red-900/10';
      case 'medium':
        return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/10';
      default:
        return 'border-l-green-500 bg-green-50 dark:bg-green-900/10';
    }
  };
  const handleCompleteClick = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setSelectedTaskId(taskId);
      setIsModalOpen(true);
    }
  };

  const handleTaskComplete = (hours: number, accepted?: boolean) => {
    if (selectedTaskId) {
      const task = tasks.find(t => t.id === selectedTaskId);
      if (task) {
        const updateData: any = {
          ...task,
          finished: true,
          status: 'completed',
          completedAt: new Date().toISOString()
        };

        // Add hours for non-supply tasks
        if (task.type !== 'insumos') {
          updateData.hours = hours;
        }

        // Update accepted status if provided
        if (accepted !== undefined && task.isRecurring) {
          updateData.accepted = accepted;
          updateData.acceptedAt = new Date().toISOString();
        }

        updateTask(updateData);
      }
      setIsModalOpen(false);
      setSelectedTaskId(null);
      // Clear selections after completion
      setSelectedTasks(prev => prev.filter(id => id !== selectedTaskId));
    }
  };

  const handleTaskSelection = (taskId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedTasks(prev => [...prev, taskId]);
    } else {
      setSelectedTasks(prev => prev.filter(id => id !== taskId));
    }
  };

  const handleSelectAll = () => {
    if (selectedTasks.length === unfinishedTasks.length) {
      setSelectedTasks([]);
    } else {
      setSelectedTasks(unfinishedTasks.map(task => task.id));
    }
  };

  const handleUseTemplate = (template: any) => {
    // Navigate to task form with template data pre-filled
    const searchParams = new URLSearchParams({
      template: JSON.stringify({
        description: template.description,
        type: template.type,
        priority: template.priority,
        estimatedHours: template.estimatedHours?.toString() || '',
        estimatedCost: template.estimatedCost?.toString() || ''
      })
    });
    window.location.href = `/add-task?${searchParams.toString()}`;
  };
  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'incident':
        return <AlertTriangle className="w-5 h-5 text-red-500 mt-1" />;
      case 'insumos':
        return <Package className="w-5 h-5 text-purple-500 mt-1" />;
      default:
        return <FileText className="w-5 h-5 text-blue-500 mt-1" />;
    }
  };

  const renderCardModal = () => {
    if (!selectedCard) return null;

    const modalContent = {
      hours: {
        title: 'Weekly Hours Breakdown',
        icon: <Clock className="w-5 h-5 text-blue-500" />,
        data: weeklyTasks.filter(t => t.type !== 'insumos').map(task => {
          const client = getClient(task.clientId);
          const project = getProject(task.projectId);
          return {
            ...task,
            clientName: client?.name || 'Unknown',
            projectName: project?.name || 'Unknown',
            revenue: (task.hours || 0) * (client?.hourlyRate || 0)
          };
        }).sort((a, b) => (b.hours || 0) - (a.hours || 0))
      },
      revenue: {
        title: 'Weekly Revenue Breakdown',
        icon: <DollarSign className="w-5 h-5 text-green-500" />,
        data: weeklyTasks.map(task => {
          const client = getClient(task.clientId);
          const project = getProject(task.projectId);
          const revenue = task.type === 'insumos' 
            ? -(task.cost || 0)
            : (task.hours || 0) * (client?.hourlyRate || 0);
          return {
            ...task,
            clientName: client?.name || 'Unknown',
            projectName: project?.name || 'Unknown',
            revenue
          };
        }).sort((a, b) => b.revenue - a.revenue)
      },
      pending: {
        title: 'Pending Tasks Analysis',
        icon: <Target className="w-5 h-5 text-purple-500" />,
        data: unfinishedTasks.map(task => {
          const client = getClient(task.clientId);
          const project = getProject(task.projectId);
          const daysOverdue = task.date < format(today, 'yyyy-MM-dd') 
            ? Math.ceil((today.getTime() - new Date(task.date).getTime()) / (1000 * 60 * 60 * 24))
            : 0;
          return {
            ...task,
            clientName: client?.name || 'Unknown',
            projectName: project?.name || 'Unknown',
            daysOverdue
          };
        }).sort((a, b) => {
          // Sort by priority first, then by days overdue
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[b.priority] - priorityOrder[a.priority];
          }
          return b.daysOverdue - a.daysOverdue;
        })
      }
    };

    const content = modalContent[selectedCard];

    return (
      <div className="fixed inset-0 z-50">
        <div 
          className="fixed inset-0 bg-black/50 animate-overlayShow dark:bg-black/70" 
          onClick={() => setSelectedCard(null)}
        />
        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-contentShow">
          <div className="w-[90vw] max-w-4xl max-h-[80vh] rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                {content.icon}
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {content.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCard(null)}
                className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[60vh]">
              {selectedCard === 'hours' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 p-4 rounded-lg dark:bg-blue-900/20">
                      <p className="text-sm text-blue-600 font-medium dark:text-blue-400">Total Hours</p>
                      <p className="text-xl font-semibold text-blue-900 dark:text-blue-300">{totalHours.toFixed(1)}h</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg dark:bg-green-900/20">
                      <p className="text-sm text-green-600 font-medium dark:text-green-400">Avg per Task</p>
                      <p className="text-xl font-semibold text-green-900 dark:text-green-300">
                        {content.data.length > 0 ? (totalHours / content.data.length).toFixed(1) : '0'}h
                      </p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg dark:bg-purple-900/20">
                      <p className="text-sm text-purple-600 font-medium dark:text-purple-400">Tasks Completed</p>
                      <p className="text-xl font-semibold text-purple-900 dark:text-purple-300">{content.data.length}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {content.data.map((task, index) => (
                      <div key={task.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg dark:bg-gray-700">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full text-blue-600 font-medium text-sm dark:bg-blue-900 dark:text-blue-300">
                            #{index + 1}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{task.clientName}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">{task.projectName}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{task.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{task.hours?.toFixed(1)}h</p>
                          <p className="text-sm text-green-600 dark:text-green-400">${task.revenue.toFixed(2)}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{format(new Date(task.date), 'MMM d')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedCard === 'revenue' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-green-50 p-4 rounded-lg dark:bg-green-900/20">
                      <p className="text-sm text-green-600 font-medium dark:text-green-400">Total Revenue</p>
                      <p className="text-xl font-semibold text-green-900 dark:text-green-300">${totalRevenue.toFixed(2)}</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg dark:bg-blue-900/20">
                      <p className="text-sm text-blue-600 font-medium dark:text-blue-400">Service Revenue</p>
                      <p className="text-xl font-semibold text-blue-900 dark:text-blue-300">
                        ${content.data.filter(t => t.revenue > 0).reduce((sum, t) => sum + t.revenue, 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg dark:bg-purple-900/20">
                      <p className="text-sm text-purple-600 font-medium dark:text-purple-400">Supply Costs</p>
                      <p className="text-xl font-semibold text-purple-900 dark:text-purple-300">
                        ${Math.abs(content.data.filter(t => t.revenue < 0).reduce((sum, t) => sum + t.revenue, 0)).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {content.data.map((task, index) => (
                      <div key={task.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg dark:bg-gray-700">
                        <div className="flex items-center space-x-3">
                          <div className={`flex items-center justify-center w-8 h-8 rounded-full font-medium text-sm ${
                            task.revenue > 0 
                              ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300'
                              : 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300'
                          }`}>
                            #{index + 1}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{task.clientName}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">{task.projectName}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{task.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${
                            task.revenue > 0 
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            ${Math.abs(task.revenue).toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {task.type === 'insumos' ? 'Supply Cost' : `${task.hours?.toFixed(1)}h`}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{format(new Date(task.date), 'MMM d')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedCard === 'pending' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-red-50 p-4 rounded-lg dark:bg-red-900/20">
                      <p className="text-sm text-red-600 font-medium dark:text-red-400">Overdue</p>
                      <p className="text-xl font-semibold text-red-900 dark:text-red-300">{overdueTasks.length}</p>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-lg dark:bg-yellow-900/20">
                      <p className="text-sm text-yellow-600 font-medium dark:text-yellow-400">Due Today</p>
                      <p className="text-xl font-semibold text-yellow-900 dark:text-yellow-300">{todayTasks.length}</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg dark:bg-blue-900/20">
                      <p className="text-sm text-blue-600 font-medium dark:text-blue-400">Upcoming</p>
                      <p className="text-xl font-semibold text-blue-900 dark:text-blue-300">{upcomingTasks.length}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {content.data.map((task, index) => (
                      <div key={task.id} className={`flex items-center justify-between p-4 rounded-lg border-l-4 ${
                        task.daysOverdue > 0
                          ? 'bg-red-50 border-red-500 dark:bg-red-900/10'
                          : isToday(new Date(task.date))
                          ? 'bg-yellow-50 border-yellow-500 dark:bg-yellow-900/10'
                          : 'bg-blue-50 border-blue-500 dark:bg-blue-900/10'
                      }`}>
                        <div className="flex items-center space-x-3 flex-1">
                          <div className={`flex items-center justify-center w-8 h-8 rounded-full font-medium text-sm ${
                            task.priority === 'high'
                              ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300'
                              : task.priority === 'medium'
                              ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-300'
                              : 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300'
                          }`}>
                            #{index + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 dark:text-white">{task.clientName}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">{task.projectName}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{task.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="text-right">
                            <TaskStatusBadge status={task.status} size="sm" />
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              task.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                              task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                              'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            }`}>
                              {task.priority}
                            </span>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {task.daysOverdue > 0
                                ? `${task.daysOverdue} days overdue`
                                : format(new Date(task.date), 'MMM d')
                              }
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            <Link
                              to={`/edit-task/${task.id}`}
                              state={{ from: '/' }}
                              className="p-2 text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                              title="Edit Task"
                            >
                              <Pencil className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => {
                                setSelectedTaskId(task.id);
                                setIsModalOpen(true);
                              }}
                              className="p-2 text-green-600 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                              title="Complete Task"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Quick Actions Bar */}
      <div className="bg-white rounded-md border border-gray-200 dark:border-gray-700 p-4 dark:bg-gray-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <h3 className="font-medium text-gray-900 dark:text-white">Quick Actions</h3>
            {selectedTasks.length > 0 && (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium dark:bg-blue-900 dark:text-blue-200">
                {selectedTasks.length} selected
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowTemplates(true)}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors"
            >
              <Template className="w-4 h-4 mr-1" />
              Templates
            </button>
            
            <button
              onClick={() => setShowRecurringTasks(true)}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 transition-colors"
            >
              <Repeat className="w-4 h-4 mr-1" />
              Recurring
            </button>
            
            <button
              onClick={() => setShowCalendarSync(true)}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-green-600 hover:text-green-700 dark:text-green-400 transition-colors"
            >
              <CalendarDays className="w-4 h-4 mr-1" />
              Calendar
            </button>

            <button
              onClick={() => exportTasksToCSV(filteredTasks, getClient, getProject, `weekly-tasks-${format(today, 'yyyy-MM-dd')}.csv`)}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 transition-colors"
            >
              <Download className="w-4 h-4 mr-1" />
              Export CSV
            </button>
            
            {unfinishedTasks.length > 0 && (
              <>
                <button
                  onClick={handleSelectAll}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-700 dark:text-gray-400 transition-colors"
                >
                  <CheckSquare className="w-4 h-4 mr-1" />
                  {selectedTasks.length === unfinishedTasks.length ? 'Deselect All' : 'Select All'}
                </button>
                
                {selectedTasks.length > 0 && (
                  <button
                    onClick={() => setShowBulkOperations(true)}
                    className="inline-flex items-center px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    <CheckSquare className="w-4 h-4 mr-1" />
                    Bulk Actions ({selectedTasks.length})
                  </button>
                )}
              </>
            )}
          </div>
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

      <TaskFilters
        priorityFilter={priorityFilter}
        typeFilter={typeFilter}
        onPriorityFilterChange={setPriorityFilter}
        onTypeFilterChange={setTypeFilter}
        onClearFilters={() => {
          setPriorityFilter('all');
          setTypeFilter('all');
        }}
        filteredCount={filteredTasks.length}
      />

      {/* Priority Tasks Section */}
      {(overdueTasks.length > 0 || todayTasks.length > 0) && taskFilter === 'all' && (
        <div className="bg-white rounded-md border border-gray-200 dark:border-gray-700 p-6 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <Zap className="w-5 h-5 text-yellow-500 mr-2" />
              Priority Tasks
            </h3>
          </div>
          
          {overdueTasks.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-red-600 dark:text-red-400 mb-3 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-1" />
                Overdue ({overdueTasks.length})
              </h4>
              <div className="space-y-2">
                {overdueTasks.slice(0, 3).map(task => {
                  const client = getClient(task.clientId);
                  const project = getProject(task.projectId);
                  
                  return (
                    <div key={task.id} className="flex justify-between items-center p-3 bg-red-50 border-l-4 border-red-500 rounded-lg dark:bg-red-900/10">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{client?.name}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">•</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{project?.name}</span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300">{task.description}</p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          Due: {getRelativeDate(task.date)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleCompleteClick(task.id)}
                        className="ml-3 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                      >
                        Complete
                      </button>
                    </div>
                  );
                })}
                {overdueTasks.length > 3 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    +{overdueTasks.length - 3} more overdue tasks
                  </p>
                )}
              </div>
            </div>
          )}
          
          {todayTasks.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-3 flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                Due Today ({todayTasks.length})
              </h4>
              <div className="space-y-2">
                {todayTasks.slice(0, 3).map(task => {
                  const client = getClient(task.clientId);
                  const project = getProject(task.projectId);
                  
                  return (
                    <div key={task.id} className="flex justify-between items-center p-3 bg-blue-50 border-l-4 border-blue-500 rounded-lg dark:bg-blue-900/10">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{client?.name}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">•</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{project?.name}</span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300">{task.description}</p>
                      </div>
                      <button
                        onClick={() => handleCompleteClick(task.id)}
                        className="ml-3 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                      >
                        Complete
                      </button>
                    </div>
                  );
                })}
                {todayTasks.length > 3 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    +{todayTasks.length - 3} more tasks due today
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {unfinishedTasks.length > 0 && (
        <div className="bg-white rounded-md border border-gray-200 dark:border-gray-700 p-6 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2" />
              Pending Tasks ({unfinishedTasks.length})
            </h3>
            <Link
              to="/add-task"
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Task
            </Link>
          </div>
          <div className="space-y-3">
            {unfinishedTasks
              .sort((a, b) => {
                // Sort by priority (high first) then by date
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                  return priorityOrder[b.priority] - priorityOrder[a.priority];
                }
                return new Date(a.date).getTime() - new Date(b.date).getTime();
              })
              .map(task => {
                const client = getClient(task.clientId);
                const project = getProject(task.projectId);
                
                return (
                  <div key={task.id} className={`flex justify-between items-center rounded-lg p-4 border-l-4 transition-all duration-200 hover:shadow-md ${getPriorityColor(task.priority)}`}>
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedTasks.includes(task.id)}
                        onChange={(e) => handleTaskSelection(task.id, e.target.checked)}
                        className="form-checkbox text-blue-600 rounded h-4 w-4"
                      />
                    <div className="flex items-start space-x-3 flex-1">
                      {getTaskIcon(task.type)}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium text-gray-900 dark:text-white">{client?.name}</h4>
                          <span className="text-sm text-gray-500 dark:text-gray-400">•</span>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{project?.name}</p>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{task.description}</p>
                        <div className="flex items-center space-x-3">
                          <TaskStatusBadge status={task.status} size="sm" />
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            task.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                            task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                            'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          }`}>
                            {task.priority} priority
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {getRelativeDate(task.date)}
                          </span>
                          {task.type === 'insumos' && task.cost && (
                            <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                              ${task.cost.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Link
                        to={`/edit-task/${task.id}`}
                        state={{ from: '/' }}
                        className="p-2 hover:bg-gray-100 rounded-lg dark:hover:bg-gray-700 transition-all duration-200 hover:scale-105"
                        title="Edit task"
                      >
                        <Pencil className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      </Link>
                      <button
                        onClick={() => handleCompleteClick(task.id)}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium 
                                 rounded-lg text-white bg-green-600 hover:bg-green-700 transform hover:scale-105
                                 dark:bg-green-500 dark:hover:bg-green-600 transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Complete
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Active Projects Dashboard */}
      {activeProjects.length > 0 && (
        <div className="bg-white rounded-md border border-gray-200 dark:border-gray-700 p-6 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <Folder className="w-5 h-5 text-blue-500 mr-2" />
              Active Projects ({activeProjects.length})
            </h3>
            <Link
              to="/projects"
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              View All Projects
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeProjects.slice(0, 6).map(project => (
              <div key={project.id} className="border rounded-lg p-4 hover:shadow-md transition-all duration-200 hover:scale-[1.02] dark:border-gray-700">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2 flex-1">
                    <Folder className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">{project.name}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                        <Users className="w-3 h-3 mr-1" />
                        {project.client?.name}
                      </p>
                    </div>
                  </div>
                  {project.pendingTasks > 0 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                      {project.pendingTasks} pending
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300">Progress</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {project.totalTasks > 0 ? Math.round((project.completedTasks / project.totalTasks) * 100) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                      style={{ 
                        width: project.totalTasks > 0 ? `${(project.completedTasks / project.totalTasks) * 100}%` : '0%' 
                      }}
                    ></div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t dark:border-gray-700">
                    <div className="text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Hours</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{project.totalHours.toFixed(1)}h</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Revenue</p>
                      <p className="text-sm font-semibold text-green-600 dark:text-green-400">${project.revenue.toFixed(0)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {activeProjects.length > 6 && (
            <div className="mt-4 text-center">
              <Link
                to="/projects"
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                View {activeProjects.length - 6} more active projects →
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-md border border-gray-200 dark:border-gray-700 p-6 dark:bg-gray-800">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            This Week's Completed Tasks
          </h2>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
          </div>
        </div>
        
        {weeklyTasks.length > 0 && (
          <div className="mb-4 p-4 bg-green-50 rounded-lg dark:bg-green-900/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="text-center">
                  <p className="text-xl font-semibold text-green-600 dark:text-green-400">{totalHours.toFixed(1)}</p>
                  <p className="text-xs text-green-600 dark:text-green-400">Hours</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-semibold text-green-600 dark:text-green-400">${totalRevenue.toFixed(0)}</p>
                  <p className="text-xs text-green-600 dark:text-green-400">Revenue</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">{weeklyTasks.length} tasks completed</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {weeklyTasks
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .map(task => {
              const client = getClient(task.clientId);
              const project = getProject(task.projectId);
              
              return (
                <div key={task.id} className="border rounded-lg p-4 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700 transition-all duration-200 hover:shadow-md">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start space-x-3 flex-1">
                      {getTaskIcon(task.type)}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-medium text-gray-900 dark:text-white">{client?.name}</h3>
                          <span className="text-sm text-gray-500 dark:text-gray-400">•</span>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{project?.name}</p>
                        </div>
                        <p className="text-sm text-gray-600 mt-1 dark:text-gray-300">{task.description}</p>
                        <div className="flex items-center space-x-2 mt-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Completed
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {getRelativeDate(task.date)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      {task.type === 'insumos' ? (
                        <div>
                          <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                            ${task.cost?.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Supply cost</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {task.hours?.toFixed(1)}h
                          </p>
                          <p className="text-sm text-green-600 dark:text-green-400">
                            ${((task.hours || 0) * (client?.hourlyRate || 0)).toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

          {weeklyTasks.length === 0 && (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 mb-2">No completed tasks this week</p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Complete pending tasks above or add new tasks to get started
              </p>
              <Link
                to="/add-task"
                className="inline-flex items-center mt-4 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add your first task
              </Link>
            </div>
          )}
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
        isRecurring={selectedTaskId ? tasks.find(t => t.id === selectedTaskId)?.isRecurring : false}
        isAccepted={selectedTaskId ? tasks.find(t => t.id === selectedTaskId)?.accepted : false}
        existingHours={selectedTaskId ? tasks.find(t => t.id === selectedTaskId)?.hours ?? undefined : undefined}
      />

      <BulkTaskOperations
        selectedTasks={selectedTasks}
        onSelectionChange={setSelectedTasks}
        isOpen={showBulkOperations}
        onClose={() => setShowBulkOperations(false)}
      />

      <TaskTemplates
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        onUseTemplate={handleUseTemplate}
      />

      <RecurringTaskManager
        isOpen={showRecurringTasks}
        onClose={() => setShowRecurringTasks(false)}
      />

      <CalendarSync
        isOpen={showCalendarSync}
        onClose={() => setShowCalendarSync(false)}
      />

      {renderCardModal()}
    </div>
  );
}