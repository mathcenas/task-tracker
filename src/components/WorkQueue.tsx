import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { parseISO, isToday, isTomorrow, isYesterday, format } from 'date-fns';
import {
  AlertTriangle, FileText, Package, Check, Pencil, Plus, ChevronDown, ChevronUp,
  Filter, Clock, Flame, CalendarClock, CheckCircle2, MoreHorizontal, X,
  Timer, StopCircle, Play
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { CompletionModal } from './CompletionModal';
import { TaskStatusBadge } from './TaskStatusBadge';

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

type FilterMode = 'active' | 'overdue' | 'today' | 'not_started' | 'all';

export function WorkQueue() {
  const { tasks, getClient, getProject, updateTask } = useApp();
  const navigate = useNavigate();

  const [filterMode, setFilterMode] = useState<FilterMode>('active');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  // Timer state
  const [timerTaskId, setTimerTaskId] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  const startTimer = (taskId: string) => {
    if (timerTaskId === taskId && timerRunning) return;
    setTimerTaskId(taskId);
    setTimerSeconds(0);
    setTimerRunning(true);
  };

  const stopTimer = () => {
    setTimerRunning(false);
  };

  const dismissTimer = () => {
    setTimerRunning(false);
    setTimerTaskId(null);
    setTimerSeconds(0);
  };

  const timerHours = parseFloat((timerSeconds / 3600).toFixed(2));

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const unfinished = tasks.filter(t => !t.finished);

  const overdue = unfinished.filter(t => {
    const d = parseISO(t.date + 'T00:00:00');
    d.setHours(0, 0, 0, 0);
    return d < now;
  });

  const todayList = unfinished.filter(t => isToday(parseISO(t.date + 'T00:00:00')));

  const notStarted = unfinished.filter(t => t.status === 'not_started');

  // "Active" = overdue + today + in_progress, sorted: overdue first, then priority
  const active = unfinished.filter(t => {
    const d = parseISO(t.date + 'T00:00:00');
    d.setHours(0, 0, 0, 0);
    return d <= now || t.status === 'in_progress';
  });

  const displayed: typeof tasks =
    filterMode === 'overdue' ? overdue :
    filterMode === 'today' ? todayList :
    filterMode === 'not_started' ? notStarted :
    filterMode === 'all' ? unfinished :
    active;

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sorted = [...displayed].sort((a, b) => {
    const aOverdue = parseISO(a.date + 'T00:00:00') < now ? 0 : 1;
    const bOverdue = parseISO(b.date + 'T00:00:00') < now ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    return (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);
  });

  const getRelativeDate = (date: string) => {
    const d = parseISO(date + 'T00:00:00');
    if (isToday(d)) return 'Today';
    if (isTomorrow(d)) return 'Tomorrow';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'MMM d');
  };

  const isOverdueTask = (date: string) => {
    const d = parseISO(date + 'T00:00:00');
    d.setHours(0, 0, 0, 0);
    return d < now;
  };

  const handleComplete = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    if (task.type === 'insumos') {
      updateTask({ ...task, finished: true, status: 'completed', completedAt: new Date().toISOString() });
    } else {
      if (timerTaskId === taskId && timerSeconds > 0) stopTimer();
      setSelectedTaskId(taskId);
      setIsModalOpen(true);
    }
  };

  const handleTaskComplete = (hours: number) => {
    if (!selectedTaskId) return;
    const task = tasks.find(t => t.id === selectedTaskId);
    if (task) {
      updateTask({ ...task, hours, finished: true, status: 'completed', completedAt: new Date().toISOString() });
    }
    if (timerTaskId === selectedTaskId) dismissTimer();
    setIsModalOpen(false);
    setSelectedTaskId(null);
  };

  const toggleStatus = async (task: typeof tasks[0]) => {
    const next = task.status === 'not_started' ? 'in_progress' :
                 task.status === 'in_progress' ? 'review' :
                 'in_progress';
    await updateTask({ ...task, status: next });
  };

  const toggleNotes = (id: string) => {
    setExpandedNotes(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const filterLabels: Record<FilterMode, string> = {
    active: 'Active',
    overdue: 'Overdue',
    today: 'Today',
    not_started: 'Not Started',
    all: 'All Open',
  };

  const counts: Record<FilterMode, number> = {
    active: active.length,
    overdue: overdue.length,
    today: todayList.length,
    not_started: notStarted.length,
    all: unfinished.length,
  };

  const typeIcon = (type: string) => {
    if (type === 'incident') return <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />;
    if (type === 'insumos') return <Package className="w-4 h-4 text-slate-500 flex-shrink-0" />;
    return <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />;
  };

  const priorityDot = (p: string) => {
    const colors = { high: 'bg-red-500', medium: 'bg-yellow-400', low: 'bg-green-500' };
    return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colors[p as keyof typeof colors] || 'bg-gray-400'}`} />;
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Work Queue</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {format(new Date(), 'EEEE, MMMM d')} · {sorted.length} task{sorted.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              showFilters
                ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-600 dark:text-blue-400'
                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            {filterLabels[filterMode]}
            {showFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <Link
            to="/add-task"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Task
          </Link>
        </div>
      </div>

      {/* Filter pills — shown when expanded */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          {(Object.keys(filterLabels) as FilterMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => { setFilterMode(mode); setShowFilters(false); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterMode === mode
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {mode === 'overdue' && <Flame className="w-3.5 h-3.5" />}
              {mode === 'today' && <CalendarClock className="w-3.5 h-3.5" />}
              {mode === 'active' && <Clock className="w-3.5 h-3.5" />}
              {filterLabels[mode]}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                filterMode === mode ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
              }`}>
                {counts[mode]}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => { setFilterMode('overdue'); setShowFilters(false); }}
          className={`p-3 rounded-xl border text-left transition-colors ${
            overdue.length > 0
              ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800 hover:border-red-400'
              : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Flame className={`w-4 h-4 ${overdue.length > 0 ? 'text-red-500' : 'text-gray-400'}`} />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Overdue</span>
          </div>
          <p className={`text-2xl font-bold ${overdue.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>
            {overdue.length}
          </p>
        </button>
        <button
          onClick={() => { setFilterMode('today'); setShowFilters(false); }}
          className="p-3 rounded-xl border bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-left hover:border-blue-300 transition-colors"
        >
          <div className="flex items-center gap-2 mb-1">
            <CalendarClock className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Today</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{todayList.length}</p>
        </button>
        <button
          onClick={() => { setFilterMode('all'); setShowFilters(false); }}
          className="p-3 rounded-xl border bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-left hover:border-gray-400 transition-colors"
        >
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Open</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{unfinished.length}</p>
        </button>
      </div>

      {/* Task list */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-400 mb-3" />
          <p className="font-medium text-gray-700 dark:text-gray-300">All clear!</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">No tasks in this view.</p>
          <Link
            to="/add-task"
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(task => {
            const client = getClient(task.clientId);
            const project = getProject(task.projectId);
            const overdue = isOverdueTask(task.date);
            const hasNotes = task.notes && task.notes.trim().length > 0;
            const notesOpen = expandedNotes.has(task.id);

            return (
              <div
                key={task.id}
                className={`group bg-white dark:bg-gray-800 rounded-xl border transition-all ${
                  overdue
                    ? 'border-red-200 dark:border-red-900/60'
                    : 'border-gray-200 dark:border-gray-700'
                } hover:shadow-sm`}
              >
                <div className="flex items-start gap-3 p-3.5">
                  {/* Complete button */}
                  <button
                    onClick={() => handleComplete(task.id)}
                    className="mt-0.5 w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 hover:border-green-500 hover:bg-green-50 dark:hover:border-green-500 dark:hover:bg-green-900/20 flex-shrink-0 transition-colors"
                    title="Mark complete"
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        {typeIcon(task.type)}
                        {priorityDot(task.priority)}
                        <span className="font-medium text-gray-900 dark:text-white text-sm leading-snug">
                          {task.description}
                        </span>
                      </div>

                      {/* Actions — visible on hover */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        {task.type !== 'insumos' && (
                          <button
                            onClick={() => timerTaskId === task.id && timerRunning ? stopTimer() : startTimer(task.id)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              timerTaskId === task.id && timerRunning
                                ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400'
                            }`}
                            title={timerTaskId === task.id && timerRunning ? 'Stop timer' : 'Start timer'}
                          >
                            {timerTaskId === task.id && timerRunning
                              ? <StopCircle className="w-4 h-4" />
                              : <Timer className="w-4 h-4" />
                            }
                          </button>
                        )}
                        <button
                          onClick={() => toggleStatus(task)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          title="Cycle status"
                        >
                          <MoreHorizontal className="w-4 h-4 text-gray-400" />
                        </button>
                        <button
                          onClick={() => navigate(`/edit-task/${task.id}`, { state: { from: '/' } })}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5 text-gray-400" />
                        </button>
                      </div>
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5">
                      <span className={`text-xs font-medium ${overdue ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                        {getRelativeDate(task.date)}
                        {overdue && ' · overdue'}
                      </span>
                      {client && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">{client.name}</span>
                      )}
                      {project && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">{project.name}</span>
                      )}
                      <TaskStatusBadge status={task.status} />
                    </div>

                    {/* Notes toggle */}
                    {hasNotes && (
                      <button
                        onClick={() => toggleNotes(task.id)}
                        className="flex items-center gap-1 mt-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      >
                        {notesOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {notesOpen ? 'Hide notes' : 'Show notes'}
                      </button>
                    )}
                    {hasNotes && notesOpen && (
                      <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2 leading-relaxed">
                        {task.notes}
                      </p>
                    )}
                  </div>

                  {/* Cost/hours badge for insumos */}
                  {task.type === 'insumos' && task.cost != null && (
                    <span className="flex-shrink-0 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-900/30 px-2 py-1 rounded-lg mt-0.5">
                      ${task.cost.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating timer bar */}
      {timerTaskId && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl border transition-all ${
          timerRunning
            ? 'bg-orange-600 border-orange-500 text-white'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white'
        }`}>
          <Timer className={`w-4 h-4 flex-shrink-0 ${timerRunning ? 'text-orange-100 animate-pulse' : 'text-orange-500'}`} />
          <div className="text-sm font-medium max-w-[180px] truncate opacity-80">
            {tasks.find(t => t.id === timerTaskId)?.description || 'Task'}
          </div>
          <span className={`font-mono text-lg font-bold tabular-nums ${timerRunning ? 'text-white' : 'text-orange-600 dark:text-orange-400'}`}>
            {formatElapsed(timerSeconds)}
          </span>
          {timerRunning ? (
            <button
              onClick={stopTimer}
              className="p-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 transition-colors"
              title="Pause timer"
            >
              <StopCircle className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => setTimerRunning(true)}
              className="p-1.5 rounded-lg bg-orange-100 dark:bg-orange-900/30 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors text-orange-600 dark:text-orange-400"
              title="Resume timer"
            >
              <Play className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={dismissTimer}
            className={`p-1.5 rounded-lg transition-colors ${timerRunning ? 'hover:bg-orange-500' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400'}`}
            title="Dismiss timer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <CompletionModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSelectedTaskId(null); }}
        onComplete={handleTaskComplete}
        taskType={selectedTaskId ? tasks.find(t => t.id === selectedTaskId)?.type || 'request' : 'request'}
        taskDescription={selectedTaskId ? tasks.find(t => t.id === selectedTaskId)?.description : undefined}
        existingHours={timerTaskId === selectedTaskId && timerSeconds > 0 ? timerHours : (selectedTaskId ? tasks.find(t => t.id === selectedTaskId)?.hours ?? undefined : undefined)}
      />
    </div>
  );
}
