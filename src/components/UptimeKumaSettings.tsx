import React, { useState, useEffect } from 'react';
import { Activity, Server, AlertCircle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { apiService } from '../services/api';

interface UptimeKumaConfig {
  enabled: boolean;
  url: string;
  username: string;
  password: string;
  createTasksOnDown: boolean;
  createTasksOnUp: boolean;
  autoAssignClient: string | null;
  autoAssignProject: string | null;
  minDowntimeSeconds: number;
}

interface UptimeKumaStatus {
  connected: boolean;
  config: {
    enabled: boolean;
    url: string;
    hasCredentials: boolean;
  };
  monitors: number;
  lastHeartbeats: number;
}

export default function UptimeKumaSettings() {
  const [config, setConfig] = useState<UptimeKumaConfig>({
    enabled: false,
    url: '',
    username: '',
    password: '',
    createTasksOnDown: true,
    createTasksOnUp: false,
    autoAssignClient: null,
    autoAssignProject: null,
    minDowntimeSeconds: 0
  });

  const [status, setStatus] = useState<UptimeKumaStatus | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadConfig();
    loadStatus();
    loadClients();
    loadProjects();

    const interval = setInterval(loadStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadConfig = async () => {
    try {
      const data = await apiService.getUptimeKumaConfig();
      setConfig(data);
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const loadStatus = async () => {
    try {
      const data = await apiService.getUptimeKumaStatus();
      setStatus(data);
    } catch (error) {
      console.error('Failed to load status:', error);
    }
  };

  const loadClients = async () => {
    try {
      const data = await apiService.getClients();
      setClients(data);
    } catch (error) {
      console.error('Failed to load clients:', error);
    }
  };

  const loadProjects = async () => {
    try {
      const data = await apiService.getProjects();
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      await apiService.saveUptimeKumaConfig(config);
      setMessage({ type: 'success', text: 'Configuration saved successfully!' });
      await loadStatus();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save configuration' });
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    setMessage(null);

    try {
      await apiService.connectUptimeKuma();
      setMessage({ type: 'success', text: 'Connected to Uptime Kuma!' });
      await loadStatus();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to connect' });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setMessage(null);

    try {
      await apiService.disconnectUptimeKuma();
      setMessage({ type: 'success', text: 'Disconnected from Uptime Kuma' });
      await loadStatus();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to disconnect' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-blue-600" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Uptime Kuma Integration
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Automatically create tasks when monitors go down or recover
                </p>
              </div>
            </div>
            {status && (
              <div className="flex items-center gap-2">
                {status.connected ? (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Connected</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <XCircle className="w-5 h-5" />
                    <span className="font-medium">Disconnected</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {message && (
          <div className={`p-4 ${message.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'} border-b`}>
            <div className="flex items-center gap-2">
              {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span>{message.text}</span>
            </div>
          </div>
        )}

        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="enabled"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="enabled" className="text-sm font-medium text-gray-900 dark:text-white">
              Enable Uptime Kuma Integration
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Uptime Kuma URL
            </label>
            <input
              type="text"
              value={config.url}
              onChange={(e) => setConfig({ ...config, url: e.target.value })}
              placeholder="http://10.8.8.21:3001 or uptime-kuma:3001"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Protocol is optional. Examples: <code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">10.8.8.21:3001</code> or <code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">http://uptime-kuma:3001</code>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Username
              </label>
              <input
                type="text"
                value={config.username}
                onChange={(e) => setConfig({ ...config, username: e.target.value })}
                placeholder="admin"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                value={config.password}
                onChange={(e) => setConfig({ ...config, password: e.target.value })}
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Task Creation Settings
            </h3>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="createTasksOnDown"
                  checked={config.createTasksOnDown}
                  onChange={(e) => setConfig({ ...config, createTasksOnDown: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="createTasksOnDown" className="text-sm text-gray-900 dark:text-white">
                  Create tasks when monitors go DOWN
                </label>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="createTasksOnUp"
                  checked={config.createTasksOnUp}
                  onChange={(e) => setConfig({ ...config, createTasksOnUp: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="createTasksOnUp" className="text-sm text-gray-900 dark:text-white">
                  Create tasks when monitors come back UP
                </label>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Minimum Downtime (seconds)
              </label>
              <input
                type="number"
                value={config.minDowntimeSeconds}
                onChange={(e) => setConfig({ ...config, minDowntimeSeconds: parseInt(e.target.value) || 0 })}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Only create tasks if downtime exceeds this duration (0 = always create)
              </p>
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Auto-Assignment
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Default Client
                </label>
                <select
                  value={config.autoAssignClient || ''}
                  onChange={(e) => setConfig({ ...config, autoAssignClient: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">None</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Default Project
                </label>
                <select
                  value={config.autoAssignProject || ''}
                  onChange={(e) => setConfig({ ...config, autoAssignProject: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">None</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {status && status.connected && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Server className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
                    Connection Status
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-blue-800 dark:text-blue-300">
                      Monitors: <span className="font-medium">{status.monitors}</span>
                    </div>
                    <div className="text-blue-800 dark:text-blue-300">
                      Active Heartbeats: <span className="font-medium">{status.lastHeartbeats}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>

            {config.enabled && (
              <>
                {status?.connected ? (
                  <button
                    onClick={handleDisconnect}
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={handleConnect}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Connect
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
