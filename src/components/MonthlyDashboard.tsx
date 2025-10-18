import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { startOfMonth, endOfMonth, format, isWithinInterval, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns';
import { AlertTriangle, FileText, ChevronLeft, ChevronRight, Package, TrendingUp, Clock, DollarSign, CheckCircle, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

export function MonthlyDashboard() {
  const { tasks, getClient, getProject } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [refreshKey, setRefreshKey] = useState(0);
  
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  // Force refresh when tasks change
  React.useEffect(() => {
    setRefreshKey(prev => prev + 1);
  }, [tasks.length, currentDate]);

  // Filter only completed tasks
  const monthlyTasks = tasks.filter(task => 
    task.finished && 
    isWithinInterval(parseISO(task.date), { start: monthStart, end: monthEnd })
  );
  
  console.log('📅 Monthly Dashboard - filtering for:', {
    month: format(currentDate, 'yyyy-MM'),
    monthStart: format(monthStart, 'yyyy-MM-dd'),
    monthEnd: format(monthEnd, 'yyyy-MM-dd'),
    totalTasks: tasks.length,
    completedTasks: tasks.filter(t => t.finished).length,
    monthlyTasks: monthlyTasks.length
  });

  const totalHours = monthlyTasks
    .filter(task => task.type !== 'insumos')
    .reduce((sum, task) => sum + (task.hours || 0), 0);

  const serviceRevenue = monthlyTasks
    .filter(task => task.type !== 'insumos')
    .reduce((sum, task) => {
      const client = getClient(task.clientId);
      return sum + ((task.hours || 0) * (client?.hourlyRate || 0));
    }, 0);

  const suppliesCost = monthlyTasks
    .filter(task => task.type === 'insumos')
    .reduce((sum, task) => sum + (task.cost || 0), 0);

  const totalRevenue = serviceRevenue - suppliesCost;

  const getRelativeDate = (date: string) => {
    const taskDate = new Date(date);
    if (isToday(taskDate)) return 'Today';
    if (isTomorrow(taskDate)) return 'Tomorrow';
    if (isYesterday(taskDate)) return 'Yesterday';
    return format(taskDate, 'MMM d');
  };

  const previousMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1));
  };

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'incident':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'insumos':
        return <Package className="w-5 h-5 text-purple-500" />;
      default:
        return <FileText className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6 dark:bg-gray-800">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Monthly Overview</h2>
          <div className="flex items-center space-x-4">
            <button
              onClick={previousMonth}
              className="p-2 hover:bg-gray-100 rounded-full dark:hover:bg-gray-700"
            >
              <ChevronLeft className="w-5 h-5 dark:text-gray-400" />
            </button>
            <span className="text-lg font-medium dark:text-white">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-gray-100 rounded-full dark:hover:bg-gray-700"
            >
              <ChevronRight className="w-5 h-5 dark:text-gray-400" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg dark:bg-blue-900/20">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-blue-500 mr-3" />
              <div>
                <p className="text-sm text-blue-600 font-medium dark:text-blue-400">Service Hours</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">{totalHours.toFixed(1)}</p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg dark:bg-green-900/20">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-green-500 mr-3" />
              <div>
                <p className="text-sm text-green-600 font-medium dark:text-green-400">Revenue</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-300">${serviceRevenue.toFixed(0)}</p>
              </div>
            </div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg dark:bg-purple-900/20">
            <div className="flex items-center">
              <Package className="w-8 h-8 text-purple-500 mr-3" />
              <div>
                <p className="text-sm text-purple-600 font-medium dark:text-purple-400">Supplies</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-300">${suppliesCost.toFixed(0)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {monthlyTasks
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .map(task => {
            const client = getClient(task.clientId);
            const project = getProject(task.projectId);
            const amount = task.type === 'insumos' 
              ? task.cost || 0
              : (task.hours || 0) * (client?.hourlyRate || 0);
            
            return (
              <div key={task.id} className="border rounded-lg p-4 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700 transition-all duration-200 hover:shadow-md group">
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
                          ${amount.toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {monthlyTasks.length === 0 && (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">No completed tasks recorded for this month</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                Tasks will appear here once they are completed
              </p>
              <Link
                to="/add-task"
                className="inline-flex items-center mt-4 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add a task
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}