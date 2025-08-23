import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { startOfWeek, endOfWeek, parseISO, format, isToday, isTomorrow, isYesterday, isThisWeek } from 'date-fns';
import { AlertTriangle, FileText, CheckCircle, Package, Clock, Calendar, TrendingUp, Plus, Pencil, Folder, Users, Target, Zap } from 'lucide-react';
import { CompletionModal } from './CompletionModal';
import { Link } from 'react-router-dom';

export function WeeklyDashboard() {
  const { tasks, projects, getClient, getProject, finishTask, updateTask, getProjectTasks } = useApp();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Start week on Monday
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  const weeklyTasks = tasks.filter(task => {
    const taskDate = parseISO(task.date);
    return taskDate >= weekStart && taskDate <= weekEnd && task.finished;
  });

  const unfinishedTasks = tasks.filter(task => !task.finished);
  
  // Categorize unfinished tasks
  const overdueTasks = unfinishedTasks.filter(task => new Date(task.date) < today);
  const todayTasks = unfinishedTasks.filter(task => isToday(new Date(task.date)));
  const upcomingTasks = unfinishedTasks.filter(task => new Date(task.date) > today);
  
  // Quick stats
  const thisWeekTasks = tasks.filter(task => isThisWeek(new Date(task.date), { weekStartsOn: 1 }));
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

  const handleTaskComplete = (hours: number) => {
    if (selectedTaskId) {
      const task = tasks.find(t => t.id === selectedTaskId);
      if (task) {
        if (task.type === 'insumos') {
          finishTask(selectedTaskId);
        } else {
          updateTask({ ...task, hours, finished: true });
        }
      }
      setIsModalOpen(false);
      setSelectedTaskId(null);
    }
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

  return (
    <div className="space-y-6">
      {/* Weekly Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-lg p-6 dark:bg-gray-800">
          <div className="flex items-center">
            <Clock className="w-8 h-8 text-blue-500 mr-3" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">This Week</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalHours.toFixed(1)}h</p>
              <p className="text-xs text-blue-600 dark:text-blue-400">
                {completionRate.toFixed(0)}% completion rate
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6 dark:bg-gray-800">
          <div className="flex items-center">
            <TrendingUp className="w-8 h-8 text-green-500 mr-3" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Revenue</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">${totalRevenue.toFixed(0)}</p>
              <p className="text-xs text-green-600 dark:text-green-400">
                ${(totalRevenue / (totalHours || 1)).toFixed(0)}/hour avg
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6 dark:bg-gray-800">
          <div className="flex items-center">
            <Target className="w-8 h-8 text-purple-500 mr-3" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Pending</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{unfinishedTasks.length}</p>
              <p className="text-xs text-purple-600 dark:text-purple-400">
                {overdueTasks.length} overdue, {todayTasks.length} today
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Priority Tasks Section */}
      {(overdueTasks.length > 0 || todayTasks.length > 0) && (
        <div className="bg-white rounded-lg shadow-lg p-6 dark:bg-gray-800">
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
        <div className="bg-white rounded-lg shadow-lg p-6 dark:bg-gray-800">
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
                    <div className="flex items-center space-x-2">
                      <Link
                        to={`/edit-task/${task.id}`}
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
        <div className="bg-white rounded-lg shadow-lg p-6 dark:bg-gray-800">
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

      <div className="bg-white rounded-lg shadow-lg p-6 dark:bg-gray-800">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
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
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{totalHours.toFixed(1)}</p>
                  <p className="text-xs text-green-600 dark:text-green-400">Hours</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">${totalRevenue.toFixed(0)}</p>
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
      />
    </div>
  );
}