import React, { useState } from 'react';
import { Calendar, Download, ExternalLink, Copy, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { format, parseISO } from 'date-fns';

interface CalendarSyncProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CalendarSync({ isOpen, onClose }: CalendarSyncProps) {
  const { tasks, getClient, getProject } = useApp();
  const [copied, setCopied] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'completed'>('pending');

  if (!isOpen) return null;

  const filteredTasks = tasks.filter(task => {
    if (selectedFilter === 'pending') return !task.finished;
    if (selectedFilter === 'completed') return task.finished;
    return true;
  });

  // Generate ICS calendar file content
  const generateICS = () => {
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//TaskTracker Pro//Task Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:TaskTracker Pro Tasks',
      'X-WR-CALDESC:Tasks from TaskTracker Pro',
      ...filteredTasks.map(task => {
        const client = getClient(task.clientId);
        const project = getProject(task.projectId);
        const startDate = format(parseISO(task.date), 'yyyyMMdd');
        const uid = `task-${task.id}@tasktracker.pro`;
        
        const summary = `${task.finished ? '✅ ' : ''}${client?.name} - ${task.description}`;
        const description = [
          `Client: ${client?.name}`,
          `Project: ${project?.name}`,
          `Type: ${task.type}`,
          `Priority: ${task.priority}`,
          task.hours ? `Hours: ${task.hours}` : '',
          task.cost ? `Cost: $${task.cost}` : '',
          task.notes ? `Notes: ${task.notes}` : ''
        ].filter(Boolean).join('\\n');

        return [
          'BEGIN:VEVENT',
          `UID:${uid}`,
          `DTSTART;VALUE=DATE:${startDate}`,
          `DTEND;VALUE=DATE:${startDate}`,
          `SUMMARY:${summary}`,
          `DESCRIPTION:${description}`,
          `STATUS:${task.finished ? 'COMPLETED' : 'CONFIRMED'}`,
          `CATEGORIES:${task.type.toUpperCase()}`,
          `PRIORITY:${task.priority === 'high' ? '1' : task.priority === 'medium' ? '5' : '9'}`,
          'END:VEVENT'
        ].join('\r\n');
      }),
      'END:VCALENDAR'
    ].join('\r\n');

    return icsContent;
  };

  const downloadICS = () => {
    const icsContent = generateICS();
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tasktracker-tasks-${format(new Date(), 'yyyy-MM-dd')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copyCalendarURL = () => {
    // In a real implementation, this would be a URL to your server that serves the ICS file
    const calendarURL = `${window.location.origin}/api/calendar/tasks.ics`;
    navigator.clipboard.writeText(calendarURL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const googleCalendarURL = () => {
    const baseURL = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
    const params = new URLSearchParams({
      text: 'TaskTracker Pro Tasks',
      details: `Import your tasks from TaskTracker Pro. Total tasks: ${filteredTasks.length}`,
      dates: format(new Date(), 'yyyyMMdd') + '/' + format(new Date(), 'yyyyMMdd')
    });
    return `${baseURL}&${params.toString()}`;
  };

  const outlookCalendarURL = () => {
    const baseURL = 'https://outlook.live.com/calendar/0/deeplink/compose';
    const params = new URLSearchParams({
      subject: 'TaskTracker Pro Tasks',
      body: `Import your tasks from TaskTracker Pro. Total tasks: ${filteredTasks.length}`,
      startdt: format(new Date(), 'yyyy-MM-dd'),
      enddt: format(new Date(), 'yyyy-MM-dd')
    });
    return `${baseURL}?${params.toString()}`;
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/50 animate-overlayShow" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-contentShow">
        <div className="w-[90vw] max-w-2xl rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
              <Calendar className="w-6 h-6 text-blue-500 mr-2" />
              Calendar Sync
            </h3>
            <button
              onClick={onClose}
              className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Filter Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Export Tasks
            </label>
            <div className="flex space-x-2">
              <button
                onClick={() => setSelectedFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedFilter === 'all'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                All Tasks ({tasks.length})
              </button>
              <button
                onClick={() => setSelectedFilter('pending')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedFilter === 'pending'
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Pending ({tasks.filter(t => !t.finished).length})
              </button>
              <button
                onClick={() => setSelectedFilter('completed')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedFilter === 'completed'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Completed ({tasks.filter(t => t.finished).length})
              </button>
            </div>
          </div>

          {/* Export Options */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 dark:text-white">Export Options</h4>
            
            {/* Download ICS File */}
            <div className="border rounded-lg p-4 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Download className="w-5 h-5 text-blue-500" />
                  <div>
                    <h5 className="font-medium text-gray-900 dark:text-white">Download Calendar File</h5>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Download an .ics file to import into any calendar app
                    </p>
                  </div>
                </div>
                <button
                  onClick={downloadICS}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Download
                </button>
              </div>
            </div>

            {/* Google Calendar */}
            <div className="border rounded-lg p-4 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-5 h-5 bg-blue-500 rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">G</span>
                  </div>
                  <div>
                    <h5 className="font-medium text-gray-900 dark:text-white">Google Calendar</h5>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Open Google Calendar to create events
                    </p>
                  </div>
                </div>
                <a
                  href={googleCalendarURL()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open
                </a>
              </div>
            </div>

            {/* Outlook Calendar */}
            <div className="border rounded-lg p-4 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">O</span>
                  </div>
                  <div>
                    <h5 className="font-medium text-gray-900 dark:text-white">Outlook Calendar</h5>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Open Outlook Calendar to create events
                    </p>
                  </div>
                </div>
                <a
                  href={outlookCalendarURL()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open
                </a>
              </div>
            </div>

            {/* Calendar Subscription URL */}
            <div className="border rounded-lg p-4 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Calendar className="w-5 h-5 text-green-500" />
                  <div>
                    <h5 className="font-medium text-gray-900 dark:text-white">Calendar Subscription</h5>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Copy URL for automatic calendar sync (future feature)
                    </p>
                  </div>
                </div>
                <button
                  onClick={copyCalendarURL}
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy URL
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg dark:bg-blue-900/20">
            <h5 className="font-medium text-blue-900 dark:text-blue-300 mb-2">How to use:</h5>
            <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
              <li>• <strong>Download:</strong> Import the .ics file into any calendar app</li>
              <li>• <strong>Google/Outlook:</strong> Opens calendar to manually create events</li>
              <li>• <strong>Subscription:</strong> Future feature for automatic sync</li>
            </ul>
          </div>

          {/* Task Preview */}
          <div className="mt-6">
            <h5 className="font-medium text-gray-900 dark:text-white mb-3">
              Preview ({filteredTasks.length} tasks)
            </h5>
            <div className="max-h-32 overflow-y-auto space-y-2">
              {filteredTasks.slice(0, 5).map(task => {
                const client = getClient(task.clientId);
                return (
                  <div key={task.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded dark:bg-gray-700">
                    <span className="truncate">
                      {task.finished ? '✅ ' : '📅 '}{client?.name} - {task.description}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 ml-2">
                      {format(parseISO(task.date), 'MMM d')}
                    </span>
                  </div>
                );
              })}
              {filteredTasks.length > 5 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  +{filteredTasks.length - 5} more tasks...
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}