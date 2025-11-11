import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { Activity, CheckCircle, XCircle, AlertTriangle, Clock, Globe, Server, Wifi, Database, Cloud } from 'lucide-react';

interface Monitor {
  id: number;
  name: string;
  type: string;
  url?: string;
  hostname?: string;
  status: 'up' | 'down' | 'pending';
  uptime: number;
  lastCheck: string;
  responseTime?: number;
  tags: string[];
}

interface StatusPageData {
  organizationName: string;
  description: string;
  monitors: Monitor[];
  overallStatus: 'operational' | 'degraded' | 'outage';
  lastUpdated: string;
}

export function PublicStatusPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<StatusPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStatusData = async () => {
      if (!slug) return;

      setLoading(true);
      setError(null);

      try {
        const apiUrl = import.meta.env.MODE === 'production' ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:3000');
        const response = await fetch(`${apiUrl}/api/public/status/${slug}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError('not_found');
          } else {
            setError('server_error');
          }
          return;
        }

        const statusData = await response.json();
        setData(statusData);
      } catch (err) {
        console.error('Error loading status page:', err);
        setError('network_error');
      } finally {
        setLoading(false);
      }
    };

    loadStatusData();

    // Refresh every 30 seconds
    const interval = setInterval(loadStatusData, 30000);
    return () => clearInterval(interval);
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading status...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-md border border-gray-200 dark:border-gray-700 p-8 dark:bg-gray-800">
            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-lg mx-auto mb-6 dark:bg-red-900/20">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Status Page Not Found</h1>
              <p className="text-gray-600 dark:text-gray-400">
                The requested status page could not be found or is not available.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getOverallStatusConfig = () => {
    switch (data.overallStatus) {
      case 'operational':
        return {
          icon: CheckCircle,
          text: 'All Systems Operational',
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          borderColor: 'border-green-200 dark:border-green-800',
          textColor: 'text-green-800 dark:text-green-200',
          iconColor: 'text-green-500'
        };
      case 'degraded':
        return {
          icon: AlertTriangle,
          text: 'Partial System Outage',
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
          borderColor: 'border-yellow-200 dark:border-yellow-800',
          textColor: 'text-yellow-800 dark:text-yellow-200',
          iconColor: 'text-yellow-500'
        };
      case 'outage':
        return {
          icon: XCircle,
          text: 'Major System Outage',
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          borderColor: 'border-red-200 dark:border-red-800',
          textColor: 'text-red-800 dark:text-red-200',
          iconColor: 'text-red-500'
        };
    }
  };

  const getMonitorIcon = (type: string) => {
    switch (type) {
      case 'http':
      case 'https':
        return Globe;
      case 'port':
        return Server;
      case 'ping':
        return Wifi;
      case 'dns':
        return Cloud;
      default:
        return Database;
    }
  };

  const getStatusBadge = (status: string, uptime: number) => {
    if (status === 'up') {
      return (
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded-full text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            Operational
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {uptime.toFixed(2)}% uptime
          </span>
        </div>
      );
    } else if (status === 'down') {
      return (
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 rounded-full text-sm font-medium">
            <XCircle className="w-4 h-4" />
            Down
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {uptime.toFixed(2)}% uptime
          </span>
        </div>
      );
    } else {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 rounded-full text-sm font-medium">
          <Clock className="w-4 h-4" />
          Pending
        </span>
      );
    }
  };

  const overallStatus = getOverallStatusConfig();
  const StatusIcon = overallStatus.icon;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white shadow-sm dark:bg-gray-800 border-b dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{data.organizationName}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">System Status</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500 dark:text-gray-400">Last updated</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {formatDistanceToNow(new Date(data.lastUpdated), { addSuffix: true })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overall Status Banner */}
        <div className={`${overallStatus.bgColor} border ${overallStatus.borderColor} rounded-lg p-6 mb-8`}>
          <div className="flex items-center justify-center gap-3">
            <StatusIcon className={`w-8 h-8 ${overallStatus.iconColor}`} />
            <h2 className={`text-2xl font-semibold ${overallStatus.textColor}`}>
              {overallStatus.text}
            </h2>
          </div>
          {data.description && (
            <p className={`text-center mt-2 ${overallStatus.textColor} opacity-80`}>
              {data.description}
            </p>
          )}
        </div>

        {/* Monitors */}
        <div className="bg-white rounded-md border border-gray-200 dark:border-gray-700 dark:bg-gray-800">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-500" />
              Services ({data.monitors.length})
            </h3>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.monitors.map((monitor) => {
              const MonitorIcon = getMonitorIcon(monitor.type);

              return (
                <div
                  key={monitor.id}
                  className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`p-2 rounded-lg ${
                        monitor.status === 'up'
                          ? 'bg-green-100 dark:bg-green-900/20'
                          : monitor.status === 'down'
                          ? 'bg-red-100 dark:bg-red-900/20'
                          : 'bg-gray-100 dark:bg-gray-700'
                      }`}>
                        <MonitorIcon className={`w-5 h-5 ${
                          monitor.status === 'up'
                            ? 'text-green-600 dark:text-green-400'
                            : monitor.status === 'down'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-gray-600 dark:text-gray-400'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                          {monitor.name}
                        </h4>
                        {(monitor.url || monitor.hostname) && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 truncate">
                            {monitor.url || monitor.hostname}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                            {monitor.type.toUpperCase()}
                          </span>
                          {monitor.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        {monitor.responseTime && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Response time: <span className="font-medium">{monitor.responseTime}ms</span>
                          </p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Last checked: {format(new Date(monitor.lastCheck), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {getStatusBadge(monitor.status, monitor.uptime)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Powered by <span className="font-semibold text-gray-700 dark:text-gray-300">TaskTracker Pro</span> with Uptime Kuma
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Status refreshes automatically every 30 seconds
          </p>
        </div>
      </div>
    </div>
  );
}
