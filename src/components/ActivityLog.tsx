import React, { useState, useEffect } from 'react';
import { Clock, FileText, Users, Folder, CheckCircle, CreditCard as Edit, Trash2, Plus, RefreshCw, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

interface ActivityLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  details: any;
  user_id: string;
  created_at: string;
}

export function ActivityLog() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'task' | 'client' | 'project'>('all');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getActivityLogs(200);
      setLogs(data);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getIcon = (entityType: string, action: string) => {
    if (action === 'created') return <Plus className="w-4 h-4" />;
    if (action === 'updated') return <Edit className="w-4 h-4" />;
    if (action === 'deleted') return <Trash2 className="w-4 h-4" />;
    if (action === 'completed') return <CheckCircle className="w-4 h-4" />;

    switch (entityType) {
      case 'task': return <FileText className="w-4 h-4" />;
      case 'client': return <Users className="w-4 h-4" />;
      case 'project': return <Folder className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'created': return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
      case 'updated': return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
      case 'deleted': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
      case 'completed': return 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  const getEntityColor = (entityType: string) => {
    switch (entityType) {
      case 'task': return 'text-blue-600 dark:text-blue-400';
      case 'client': return 'text-purple-600 dark:text-purple-400';
      case 'project': return 'text-green-600 dark:text-green-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const formatDetails = (details: any) => {
    if (!details) return null;

    const items = [];
    if (details.hours !== undefined) items.push(`${details.hours}h`);
    if (details.cost !== undefined) items.push(`$${details.cost}`);
    if (details.status) items.push(details.status);
    if (details.type) items.push(details.type);
    if (details.hourlyRate !== undefined) items.push(`Rate: $${details.hourlyRate}/h`);

    return items.length > 0 ? items.join(' • ') : null;
  };

  const filteredLogs = filter === 'all'
    ? logs
    : logs.filter(log => log.entity_type === filter);

  const handleLogClick = (log: ActivityLog) => {
    if (log.entity_type === 'task' && log.action !== 'deleted') {
      navigate(`/edit-task/${log.entity_id}`, { state: { from: '/activity-log' } });
    } else if (log.entity_type === 'client') {
      navigate('/clients');
    } else if (log.entity_type === 'project') {
      navigate('/projects');
    }
  };

  const isClickable = (log: ActivityLog) => {
    return (log.entity_type === 'task' && log.action !== 'deleted') ||
           log.entity_type === 'client' ||
           log.entity_type === 'project';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Activity Log</h1>
              </div>
              <button
                onClick={fetchLogs}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </button>
            </div>

            {/* Filters */}
            <div className="flex space-x-2 mt-4">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('task')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'task'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Tasks
              </button>
              <button
                onClick={() => setFilter('client')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'client'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Clients
              </button>
              <button
                onClick={() => setFilter('project')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'project'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Projects
              </button>
            </div>
          </div>

          {/* Log Entries */}
          <div className="p-6">
            {loading ? (
              <div className="text-center py-12">
                <Clock className="w-8 h-8 text-gray-400 mx-auto mb-3 animate-spin" />
                <p className="text-gray-500 dark:text-gray-400">Loading activity logs...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No activity logs yet</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Actions you perform will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    onClick={() => isClickable(log) && handleLogClick(log)}
                    className={`flex items-start space-x-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group ${
                      isClickable(log) ? 'cursor-pointer hover:border-blue-400 dark:hover:border-blue-500' : ''
                    }`}
                  >
                    {/* Icon */}
                    <div className={`flex-shrink-0 p-2 rounded-lg ${getActionColor(log.action)}`}>
                      {getIcon(log.entity_type, log.action)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                        <span className={`text-sm font-medium ${getEntityColor(log.entity_type)}`}>
                          {log.entity_type}
                        </span>
                        {isClickable(log) && (
                          <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>

                      <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white truncate">
                        {log.entity_name}
                      </p>

                      {formatDetails(log.details) && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {formatDetails(log.details)}
                        </p>
                      )}

                      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        {format(new Date(log.created_at), 'MMM d, yyyy • h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Info */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Showing {filteredLogs.length} {filteredLogs.length === 1 ? 'entry' : 'entries'}
              {filter !== 'all' && ` • Filtered by ${filter}`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
