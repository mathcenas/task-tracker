import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Task } from '../types';
import { format, parseISO, isToday, isPast } from 'date-fns';
import { Calendar, User, AlertCircle, CheckCircle, Clock, Filter, X } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors,
  useDraggable, useDroppable, closestCenter, type DragStartEvent, type DragEndEvent
} from '@dnd-kit/core';

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
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // distance/delay thresholds keep a plain tap-to-open-task working - a
  // drag only "activates" once the pointer has actually moved, so a click
  // with no movement still reaches the card's Link normally. Touch gets a
  // short delay too, so starting to scroll the page doesn't get mistaken
  // for picking up a card.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  // Filters stored in URL so they survive navigating to EditTask and back
  const filterClient = searchParams.get('client') || 'all';
  const filterProject = searchParams.get('project') || 'all';

  const setFilters = (updates: Record<string, string>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([key, value]) => {
        if (!value || value === 'all') next.delete(key);
        else next.set(key, value);
      });
      return next;
    }, { replace: true });
  };

  const setFilterProject = (v: string) => setFilters({ project: v });

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

  const activeTask = activeTaskId ? filteredTasks.find(t => t.id === activeTaskId) ?? null : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTaskId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTaskId(null);
    if (!over) return;

    const newStatus = over.id as TaskStatus;
    const task = filteredTasks.find(t => t.id === active.id);
    if (task && task.status !== newStatus) {
      await updateTask({ ...task, status: newStatus });
    }
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
      case 'problem':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'change':
        return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200';
      case 'request':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'insumos':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  // Pure visual - shared between the card sitting in a column and the
  // floating copy the DragOverlay renders under the pointer while dragging.
  const TaskCardContent = ({ task }: { task: Task }) => {
    const client = getClient(task.clientId);
    const project = getProject(task.projectId);
    const taskDate = parseISO(task.date + 'T00:00:00');
    const isOverdue = isPast(taskDate) && !isToday(taskDate);

    return (
      <div className={`p-3 rounded-md border-l-4 ${getPriorityColor(task.priority)} hover:border-gray-300 dark:hover:border-gray-600`}>
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
    );
  };

  const TaskCard = ({ task }: { task: Task }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });

    return (
      <div ref={setNodeRef} {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing touch-none" style={{ opacity: isDragging ? 0.4 : 1 }}>
        <Link to={`/edit-task/${task.id}`} state={{ from: `${location.pathname}${location.search}` }}>
          <TaskCardContent task={task} />
        </Link>
      </div>
    );
  };

  const KanbanColumn = ({ column, columnTasks }: { column: Column; columnTasks: Task[] }) => {
    const { setNodeRef, isOver } = useDroppable({ id: column.id });

    return (
      <div
        ref={setNodeRef}
        className={`bg-gray-50 dark:bg-gray-800/50 border rounded-md p-3 transition-colors ${
          isOver ? 'border-blue-400 dark:border-blue-500 ring-2 ring-blue-400/30' : 'border-gray-200 dark:border-gray-700'
        }`}
      >
        <div className={`flex items-center space-x-2 mb-3 pb-2 border-b ${column.color}`}>
          <div className={column.color}>
            {column.icon}
          </div>
          <h3 className={`font-medium text-sm ${column.color}`}>
            {column.title}
          </h3>
          <span className={`ml-auto px-1.5 py-0.5 ${column.bgColor} ${column.color} rounded text-xs`}>
            {columnTasks.length}
          </span>
        </div>

        <div className="space-y-2 min-h-[200px]">
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
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Kanban Board</h1>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="inline-flex items-center px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
        >
          <Filter className="w-4 h-4 mr-1.5" />
          Filters
          {(filterClient !== 'all' || filterProject !== 'all') && (
            <span className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs">
              Active
            </span>
          )}
        </button>
      </div>

      {showFilters && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-3">
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
                onChange={(e) => setFilters({ client: e.target.value, project: 'all' })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
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
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {columns.map((column) => (
            <KanbanColumn key={column.id} column={column} columnTasks={getTasksByStatus(column.id)} />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="shadow-xl rounded-md rotate-2 cursor-grabbing">
              <TaskCardContent task={activeTask} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
