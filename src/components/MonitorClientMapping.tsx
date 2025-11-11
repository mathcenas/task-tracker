import React, { useState, useEffect } from 'react';
import { Monitor, Users, Save, RefreshCw, CheckCircle, AlertCircle, Link as LinkIcon } from 'lucide-react';
import { apiService } from '../services/api';

interface UptimeMonitor {
  id: number;
  name: string;
  type: string;
  url?: string;
  hostname?: string;
  active: number;
  tags: string[];
}

interface Client {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
  client_id: string;
}

interface MonitorMapping {
  monitor_id: number;
  client_id: string | null;
  project_id: string | null;
}

export default function MonitorClientMapping() {
  const [monitors, setMonitors] = useState<UptimeMonitor[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [mappings, setMappings] = useState<Record<number, MonitorMapping>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [kumaStatus, setKumaStatus] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statusData, clientsData, projectsData, mappingsData] = await Promise.all([
        apiService.getUptimeKumaStatus(),
        apiService.getClients(),
        apiService.getProjects(),
        apiService.getMonitorMappings()
      ]);

      console.log('Kuma Status:', statusData);
      console.log('Monitors received:', statusData.monitors);

      setKumaStatus(statusData);
      setClients(clientsData);
      setProjects(projectsData);

      // Convert mappings array to object for easy lookup
      const mappingsObj: Record<number, MonitorMapping> = {};
      if (mappingsData && Array.isArray(mappingsData)) {
        mappingsData.forEach((mapping: any) => {
          mappingsObj[mapping.monitor_id] = {
            monitor_id: mapping.monitor_id,
            client_id: mapping.client_id,
            project_id: mapping.project_id
          };
        });
      }
      setMappings(mappingsObj);

      // Get monitors from status
      if (statusData.monitors && Array.isArray(statusData.monitors)) {
        console.log(`Setting ${statusData.monitors.length} monitors`);
        setMonitors(statusData.monitors);
      } else {
        console.log('No monitors found in status data');
        setMonitors([]);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      setMessage({ type: 'error', text: 'Failed to load monitors and clients' });
    } finally {
      setLoading(false);
    }
  };

  const handleMappingChange = (monitorId: number, field: 'client_id' | 'project_id', value: string) => {
    setMappings(prev => ({
      ...prev,
      [monitorId]: {
        monitor_id: monitorId,
        client_id: field === 'client_id' ? (value || null) : (prev[monitorId]?.client_id || null),
        project_id: field === 'project_id' ? (value || null) : (prev[monitorId]?.project_id || null)
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      // Convert mappings object to array
      const mappingsArray = Object.values(mappings).filter(m => m.client_id || m.project_id);

      await apiService.saveMonitorMappings(mappingsArray);
      setMessage({ type: 'success', text: 'Monitor mappings saved successfully!' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save mappings' });
    } finally {
      setSaving(false);
    }
  };

  const getProjectsForClient = (clientId: string) => {
    return projects.filter(p => p.client_id === clientId);
  };

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : '';
  };

  if (!kumaStatus?.connected || !kumaStatus?.authenticated) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6">
            <div className="text-center py-12">
              <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {!kumaStatus?.connected ? 'Uptime Kuma Not Connected' : 'Uptime Kuma Not Authenticated'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {!kumaStatus?.connected
                  ? 'Please connect to Uptime Kuma first to sync monitors.'
                  : 'Connected but not authenticated. Please check your credentials.'}
              </p>
              {kumaStatus?.connected && kumaStatus?.authenticated === false && (
                <p className="text-sm text-red-600 dark:text-red-400 mb-4">
                  Authentication failed. Please verify your username and password in settings.
                </p>
              )}
              <a
                href="/integrations/uptime-kuma"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Uptime Kuma Settings
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LinkIcon className="w-8 h-8 text-blue-600" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Monitor-Client Mapping
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Link Uptime Kuma monitors to clients and projects for automatic task creation
                </p>
              </div>
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
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

        <div className="p-6">
          {monitors.length === 0 ? (
            <div className="text-center py-12">
              <Monitor className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No Monitors Found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Add monitors in Uptime Kuma first, then refresh this page.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
                  <Monitor className="w-5 h-5" />
                  How It Works
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-300 mb-2">
                  Map each Uptime Kuma monitor to a client and/or project. When a monitor goes down:
                </p>
                <ul className="text-sm text-blue-800 dark:text-blue-300 list-disc list-inside space-y-1">
                  <li>A high-priority incident task will be automatically created</li>
                  <li>The task will be assigned to the mapped client and project</li>
                  <li>Task details will include monitor info, downtime, and error messages</li>
                </ul>
              </div>

              <div className="space-y-4">
                {monitors.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                    <Monitor className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No Monitors Found
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Connected to Uptime Kuma but no monitors are available.
                    </p>
                    <button
                      onClick={loadData}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Refresh Monitors
                    </button>
                  </div>
                ) : (
                  monitors.map((monitor) => {
                  const mapping = mappings[monitor.id] || { monitor_id: monitor.id, client_id: null, project_id: null };
                  const selectedClient = mapping.client_id;
                  const clientProjects = selectedClient ? getProjectsForClient(selectedClient) : [];

                  return (
                    <div
                      key={monitor.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${monitor.active === 1 ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
                          <Monitor className={`w-5 h-5 ${monitor.active === 1 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                              {monitor.name}
                            </h4>
                            <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                              {monitor.type.toUpperCase()}
                            </span>
                            {monitor.active === 1 ? (
                              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded">
                                UP
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 rounded">
                                DOWN
                              </span>
                            )}
                          </div>
                          {(monitor.url || monitor.hostname) && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 truncate">
                              {monitor.url || monitor.hostname}
                            </p>
                          )}

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Client
                              </label>
                              <select
                                value={mapping.client_id || ''}
                                onChange={(e) => {
                                  handleMappingChange(monitor.id, 'client_id', e.target.value);
                                  // Clear project when client changes
                                  if (e.target.value !== mapping.client_id) {
                                    handleMappingChange(monitor.id, 'project_id', '');
                                  }
                                }}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                              >
                                <option value="">None</option>
                                {clients.map(client => (
                                  <option key={client.id} value={client.id}>{client.name}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Project (Optional)
                              </label>
                              <select
                                value={mapping.project_id || ''}
                                onChange={(e) => handleMappingChange(monitor.id, 'project_id', e.target.value)}
                                disabled={!selectedClient}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <option value="">None</option>
                                {clientProjects.map(project => (
                                  <option key={project.id} value={project.id}>
                                    {getClientName(project.client_id)} - {project.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
                )}
              </div>

              <div className="flex items-center gap-4 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Mappings'}
                </button>

                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {Object.values(mappings).filter(m => m.client_id).length} of {monitors.length} monitors mapped
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
