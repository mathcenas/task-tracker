import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Task } from '../types';
import { format, parseISO, isToday, isPast } from 'date-fns';
import { Calendar, User, AlertCircle, CheckCircle, Clock, Filter, X } from 'lucide-react';
import { Link } from 'react-router-dom';

type TaskStatus = 'not_started' | 'in_progress' | 'review' | 'completed';

interface Column {
  id: TaskStatus;
  title: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const columns: Column[] = [
  {
    id: 'not_started',
    title: 'Not Started',
    icon: <Clock className="w-5 h-5" />,
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-700'
  },
  {
    id: 'in_progress',
    title: 'In Progress',
    icon: <AlertCircle className="w-5 h-5" />,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/20'
  },
  {
    id: 'review',
    title: 'Review',
    icon: <User className="w-5 h-5" />,
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/20'
  },
  {
    id: 'completed',
    title: 'Completed',
    icon: <CheckCircle className="w-5 h-5" />,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/20'
  }
];

export function KanbanBoard() {
  const { tasks, clients, projects, getClient, getProject, updateTask } = useApp();
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const filteredProjects = filterClient !== 'all'
    ? projects.filter(p => p.clientId === filterClient)
    : projects;

  const filteredTasks = tasks.filter(task => {
    if (!task.finished) {
      if (filterClient !== 'all' && task.clientId !== filterClient) return false;
      if (filterProject !== 'all' && task.projectId !== filterProject) return false;
      return true;
    }
    return false;
  });

  const getTasksByStatus = (status: TaskStatus) => {
    return filteredTasks.filter(task => task.status === status);
  };

  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (status: TaskStatus) => {
    if (!draggedTask) return;

    if (draggedTask.status !== status) {
      await updateTask(draggedTask.id, { ...draggedTask, status });
    }

    setDraggedTask(null);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-red-500 bg-red-50 dark:bg-red-900/10';
      case 'medium':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10';
      case 'low':
        return 'border-green-500 bg-green-50 dark:bg-green-900/10';
      default:
        return 'border-gray-300 bg-white dark:bg-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'incident':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'request':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'insumos':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const TaskCard = ({ task }: { task: Task }) => {
    const client = getClient(task.clientId);
    const project = getProject(task.projectId);
    const taskDate = parseISO(task.date + 'T00:00:00');
    const isOverdue = isPast(taskDate) && !isToday(taskDate);

    return (
      <Link to={`/edit-task/${task.id}`}>
        <div
          draggable
          onDragStart={() => handleDragStart(task)}
          className={`p-4 rounded-lg border-l-4 ${getPriorityColor(task.priority)} cursor-move hover:shadow-md transition-all duration-200`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-1 line-clamp-2">
                {task.description}
              </h4>
              <div className="flex items-center space-x-2 text-xs text-gray-600 dark:text-gray-400">
                <span className="font-medium">{client?.name}</span>
                <span>•</span>
                <span>{project?.name}</span>
              </div>
            </div>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getTypeColor(task.type)}`}>
              {task.type}
            </span>
          </div>

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center space-x-2">
              <Calendar className="w-3 h-3 text-gray-400" />
              <span className={`text-xs ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                {format(taskDate, 'MMM d, yyyy')}
                {isOverdue && ' (Overdue)'}
              </span>
            </div>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              task.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
              task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
              'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            }`}>
              {task.priority}
            </span>
          </div>

          {task.hours && (
            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              Estimated: {task.hours}h
            </div>
          )}
        </div>
      </Link>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Kanban Board</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Drag and drop tasks to update their status
          </p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="inline-flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <Filter className="w-5 h-5 mr-2" />
          Filters
          {(filterClient !== 'all' || filterProject !== 'all') && (
            <span className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs">
              Active
            </span>
          )}
        </button>
      </div>

      {showFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900 dark:text-white">Filters</h3>
            <button
              onClick={() => setShowFilters(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Client
              </label>
              <select
                value={filterClient}
                onChange={(e) => {
                  setFilterClient(e.target.value);
                  setFilterProject('all');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="all">All Clients</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Project
              </label>
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                disabled={filterClient === 'all'}
              >
                <option value="all">All Projects</option>
                {filteredProjects.map(project => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {columns.map((column) => {
          const columnTasks = getTasksByStatus(column.id);
          return (
            <div
              key={column.id}
              className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4"
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(column.id)}
            >
              <div className={`flex items-center space-x-2 mb-4 pb-3 border-b-2 ${column.bgColor} rounded-lg p-3`}>
                <div className={column.color}>
                  {column.icon}
                </div>
                <h3 className={`font-semibold ${column.color}`}>
                  {column.title}
                </h3>
                <span className={`ml-auto px-2 py-1 ${column.bgColor} ${column.color} rounded-full text-xs font-medium`}>
                  {columnTasks.length}
                </span>
              </div>

              <div className="space-y-3 min-h-[200px]">
                {columnTasks.length === 0 ? (
                  <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-8">
                    No tasks
                  </p>
                ) : (
                  columnTasks.map(task => (
                    <TaskCard key={task.id} task={task} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
