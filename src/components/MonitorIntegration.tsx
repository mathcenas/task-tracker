import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, Plus, Trash2, ExternalLink, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { apiService } from '../services/api';
import { useApp } from '../context/AppContext';

interface MonitorFeed {
  id: string;
  name: string;
  url: string;
  clientId: string | null;
  projectId: string | null;
  enabled: boolean;
  lastChecked: string | null;
  createdAt: string;
}

interface MonitorStatus {
  name: string;
  status: 'up' | 'down' | 'unknown';
  lastCheck?: string;
  responseTime?: number;
  uptime?: number;
}

export default function MonitorIntegration() {
  const { clients, projects } = useApp();
  const [feeds, setFeeds] = useState<MonitorFeed[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, MonitorStatus[]>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    url: '',
    clientId: '',
    projectId: '',
    enabled: true
  });

  useEffect(() => {
    loadFeeds();
  }, []);

  const loadFeeds = async () => {
    try {
      const data = await apiService.getMonitorFeeds();
      setFeeds(data);

      // Load statuses for all enabled feeds
      const statusPromises = data
        .filter((f: MonitorFeed) => f.enabled)
        .map((f: MonitorFeed) => loadFeedStatus(f.id, f.url));

      await Promise.all(statusPromises);
    } catch (error) {
      console.error('Failed to load monitor feeds:', error);
    }
  };

  const loadFeedStatus = async (feedId: string, url: string) => {
    try {
      const response = await fetch(url);
      const data = await response.json();

      // Support multiple JSON formats
      let monitors: MonitorStatus[] = [];

      // Uptime Kuma Status Page API format
      if (data.publicGroupList && Array.isArray(data.publicGroupList)) {
        data.publicGroupList.forEach((group: any) => {
          if (group.monitorList && Array.isArray(group.monitorList)) {
            group.monitorList.forEach((monitor: any) => {
              // Get heartbeat data if available
              const heartbeat = data.heartbeatList?.[monitor.id]?.at(-1);

              monitors.push({
                name: monitor.name || 'Unknown',
                status: parseStatus(heartbeat?.status ?? monitor.status),
                lastCheck: heartbeat?.time || monitor.lastCheck,
                responseTime: heartbeat?.ping || monitor.avgPing || monitor.ping,
                uptime: monitor.uptime24 || monitor.uptime
              });
            });
          }
        });
      }
      // Simple array format
      else if (Array.isArray(data)) {
        monitors = data.map((item: any) => ({
          name: item.name || item.monitor || item.service || 'Unknown',
          status: parseStatus(item.status || item.state),
          lastCheck: item.lastCheck || item.checked_at || item.timestamp,
          responseTime: item.responseTime || item.response_time || item.latency || item.avgPing || item.ping,
          uptime: item.uptime || item.availability || item.uptime24
        }));
      }
      // Object with monitors array
      else if (data.monitors && Array.isArray(data.monitors)) {
        monitors = data.monitors.map((item: any) => ({
          name: item.name || item.monitor || 'Unknown',
          status: parseStatus(item.status || item.state),
          lastCheck: item.lastCheck || item.checked_at,
          responseTime: item.responseTime || item.latency || item.avgPing || item.ping,
          uptime: item.uptime || item.uptime24
        }));
      }

      console.log(`Feed ${feedId}: Parsed ${monitors.length} monitors`, monitors);
      setStatuses(prev => ({ ...prev, [feedId]: monitors }));
    } catch (error) {
      console.error(`Failed to load status for feed ${feedId}:`, error);
      setStatuses(prev => ({ ...prev, [feedId]: [] }));
    }
  };

  const parseStatus = (status: any): 'up' | 'down' | 'unknown' => {
    if (status === null || status === undefined) return 'unknown';

    // Handle numeric status codes (Uptime Kuma uses: 0=down, 1=up, 2=pending)
    if (typeof status === 'number') {
      if (status === 1) return 'up';
      if (status === 0) return 'down';
      return 'unknown';
    }

    const statusStr = String(status).toLowerCase();
    if (statusStr === 'up' || statusStr === 'online' || statusStr === 'active' || statusStr === '1' || statusStr === 'true') {
      return 'up';
    }
    if (statusStr === 'down' || statusStr === 'offline' || statusStr === 'inactive' || statusStr === '0' || statusStr === 'false') {
      return 'down';
    }
    return 'unknown';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      await apiService.createMonitorFeed(formData);
      setMessage({ type: 'success', text: 'Monitor feed added successfully' });
      setFormData({ name: '', url: '', clientId: '', projectId: '', enabled: true });
      setShowAddForm(false);
      loadFeeds();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to add monitor feed' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this monitor feed?')) return;

    try {
      await apiService.deleteMonitorFeed(id);
      setMessage({ type: 'success', text: 'Monitor feed deleted' });
      loadFeeds();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete monitor feed' });
    }
  };

  const handleToggleEnabled = async (feed: MonitorFeed) => {
    try {
      await apiService.updateMonitorFeed(feed.id, { ...feed, enabled: !feed.enabled });
      loadFeeds();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update monitor feed' });
    }
  };

  const handleRefresh = async (feedId: string, url: string) => {
    await loadFeedStatus(feedId, url);
    setMessage({ type: 'success', text: 'Status refreshed' });
  };

  const getStatusIcon = (status: 'up' | 'down' | 'unknown') => {
    switch (status) {
      case 'up':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'down':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Monitor Integration</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Connect external monitoring feeds via JSON endpoints</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Feed
          </button>
        </div>

        {message && (
          <div className={`mb-4 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {showAddForm && (
          <form onSubmit={handleSubmit} className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Feed Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="Production Servers"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  JSON Endpoint URL
                </label>
                <input
                  type="url"
                  required
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="https://monitoring.example.com/status.json"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Assign to Client (Optional)
                </label>
                <select
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value, projectId: '' })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                >
                  <option value="">-- Select Client --</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Assign to Project (Optional)
                </label>
                <select
                  value={formData.projectId}
                  onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  disabled={!formData.clientId}
                >
                  <option value="">-- Select Project --</option>
                  {projects
                    .filter(p => p.client_id === formData.clientId)
                    .map(project => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setFormData({ name: '', url: '', clientId: '', projectId: '', enabled: true });
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Adding...' : 'Add Feed'}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-4">
          {feeds.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">No monitor feeds configured yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                Add a JSON endpoint to start monitoring external services
              </p>
            </div>
          ) : (
            feeds.map(feed => {
              const client = clients.find(c => c.id === feed.clientId);
              const project = projects.find(p => p.id === feed.projectId);
              const feedStatuses = statuses[feed.id] || [];

              return (
                <div
                  key={feed.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                          {feed.name}
                        </h3>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={feed.enabled}
                            onChange={() => handleToggleEnabled(feed)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                        <a
                          href={feed.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          {feed.url}
                        </a>
                        {client && <span>• {client.name}</span>}
                        {project && <span>• {project.name}</span>}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleRefresh(feed.id, feed.url)}
                        disabled={!feed.enabled}
                        className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50"
                        title="Refresh status"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(feed.id)}
                        className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="Delete feed"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {feed.enabled && feedStatuses.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                      {feedStatuses.map((monitor, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                        >
                          {getStatusIcon(monitor.status)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {monitor.name}
                            </p>
                            {monitor.responseTime && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {monitor.responseTime}ms
                                {monitor.uptime && ` • ${monitor.uptime}% uptime`}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {feed.enabled && feedStatuses.length === 0 && (
                    <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                      No monitor data available
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-3">
            How to Connect Uptime Kuma
          </h3>
          <ol className="text-xs text-blue-800 dark:text-blue-400 space-y-2 list-decimal list-inside mb-4">
            <li>In Uptime Kuma, go to <strong>Status Pages</strong></li>
            <li>Create or edit a status page and enable <strong>Public</strong> access</li>
            <li>In the status page settings, enable <strong>Show Heartbeats</strong> or <strong>Show Recent Pings</strong></li>
            <li>Copy the status page URL (e.g., <code className="text-xs">https://your-kuma.com/status/mypage</code>)</li>
            <li>Add <code className="text-xs">/api/status-page/mypage</code> to get the JSON endpoint</li>
            <li>Paste the full URL here (e.g., <code className="text-xs">https://your-kuma.com/api/status-page/mypage</code>)</li>
          </ol>
          <p className="text-xs text-blue-700 dark:text-blue-400 italic">
            Note: If monitors show as "unknown", make sure heartbeat data is enabled in your Uptime Kuma status page settings.
          </p>

          <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2 mt-4">
            Other Supported JSON Formats
          </h3>
          <div className="text-xs text-blue-800 dark:text-blue-400 space-y-2 font-mono">
            <div>
              <strong>Array format:</strong><br/>
              <code>[{`{ "name": "Server 1", "status": "up", "responseTime": 45 }`}]</code>
            </div>
            <div>
              <strong>Object format:</strong><br/>
              <code>{`{ "monitors": [{ "name": "Server 1", "status": "up" }] }`}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
