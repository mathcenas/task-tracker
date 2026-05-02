import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, PlusCircle, Clock, Calendar, Folders, Menu, X, Search, BarChart3, CheckSquare, Repeat, Columns2 as Columns, ChevronLeft, ChevronRight, Download, Upload, Activity, FileSpreadsheet, History, Globe, FileText, Building2, Lightbulb, Database, Package } from 'lucide-react';
import { ThemeToggle } from './ui/ThemeToggle';
import { UserProfile } from './auth/UserProfile';
import { QuickTaskEntry } from './QuickTaskEntry';
import { api } from '../services/api';
import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

const getSession = () => {
  try {
    const encryptedSession = localStorage.getItem('tasktracker_session');
    if (!encryptedSession) return null;
    return JSON.parse(atob(encryptedSession));
  } catch {
    return null;
  }
};

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { tasks, clients, projects, getClient, getProject } = useApp();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const session = getSession();
  const [currentUser] = useState(session ? {
    username: session.username,
    role: session.role
  } : null);

  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const backup = await api.exportBackup();
      const dataStr = JSON.stringify(backup, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tasktracker-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const meta = backup.metadata;
      alert(`✅ Backup Downloaded!\n\n` +
        `📊 Total Records: ${meta.totalRecords}\n` +
        `👥 Clients: ${meta.totalClients}\n` +
        `📁 Projects: ${meta.totalProjects}\n` +
        `✓ Tasks: ${meta.totalTasks}\n` +
        `🔄 Recurring: ${meta.totalRecurringTasks}\n` +
        `📋 Templates: ${meta.totalTaskTemplates}\n\n` +
        `📅 ${new Date(backup.exportDate).toLocaleString()}\n` +
        `Version: ${backup.version}`);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export backup');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!confirm('This will import all data from the backup. Continue?')) {
      event.target.value = '';
      return;
    }

    setIsImporting(true);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      const clients = backup.clients || backup.data?.clients || [];
      const projects = backup.projects || backup.data?.projects || [];
      const tasks = backup.tasks || backup.data?.tasks || [];
      const recurringTasks = backup.recurringTasks || backup.data?.recurringTasks || [];
      const taskTemplates = backup.taskTemplates || backup.data?.taskTemplates || [];

      if (clients.length === 0 && projects.length === 0 && tasks.length === 0) {
        throw new Error('Invalid backup file format or empty backup');
      }

      const meta = backup.metadata || {
        totalClients: clients.length,
        totalProjects: projects.length,
        totalTasks: tasks.length,
        totalRecurringTasks: recurringTasks.length,
        totalTaskTemplates: taskTemplates.length,
        totalRecords: clients.length + projects.length + tasks.length + recurringTasks.length + taskTemplates.length
      };

      const confirmMsg = `Import backup with:\n\n` +
        `📊 Total Records: ${meta.totalRecords}\n` +
        `👥 Clients: ${meta.totalClients}\n` +
        `📁 Projects: ${meta.totalProjects}\n` +
        `✓ Tasks: ${meta.totalTasks}\n` +
        `🔄 Recurring: ${meta.totalRecurringTasks}\n` +
        `📋 Templates: ${meta.totalTaskTemplates}\n\n` +
        `📅 ${new Date(backup.exportDate).toLocaleString()}\n` +
        `Version: ${backup.version}\n\n` +
        `Continue?`;

      if (!confirm(confirmMsg)) {
        event.target.value = '';
        setIsImporting(false);
        return;
      }

      const normalizedBackup = {
        ...backup,
        clients,
        projects,
        tasks,
        recurringTasks,
        taskTemplates
      };

      await api.importBackup(normalizedBackup);
      alert('✅ Backup imported successfully! Reloading...');
      window.location.reload();
    } catch (err) {
      console.error('Import error:', err);
      alert(`Failed to import backup: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  // Force refresh when data changes
  React.useEffect(() => {
    setRefreshKey(prev => prev + 1);
  }, [tasks.length, clients.length, projects.length]);

  // Search functionality
  const searchResults = searchQuery.length > 2 ? {
    tasks: tasks.filter(task => 
      task.description.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 5),
    clients: clients.filter(client => 
      client.name.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 3),
    projects: projects.filter(project => 
      project.name.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 3)
  } : { tasks: [], clients: [], projects: [] };
  
  useEffect(() => {
    const handleClickOutside = () => setShowSearchResults(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const isActive = (path: string) => {
    return location.pathname === path
      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-r-2 border-blue-600'
      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700';
  };

  const menuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Weekly', group: 'Dashboards' },
    { path: '/fortnight', icon: Calendar, label: '15 Days', group: 'Dashboards' },
    { path: '/monthly', icon: Calendar, label: 'Monthly', group: 'Dashboards' },
    { path: '/overview', icon: BarChart3, label: 'Overview', group: 'Dashboards' },
    { path: '/tasks', icon: CheckSquare, label: 'All Tasks', group: 'Tasks' },
    { path: '/kanban', icon: Columns, label: 'Kanban', group: 'Tasks' },
    { path: '/ideas', icon: Lightbulb, label: 'Ideas Board', group: 'Tasks' },
    { path: '/supplies', icon: Package, label: 'Supplies', group: 'Tasks' },
    { path: '/recurring-tasks', icon: Repeat, label: 'Recurring', group: 'Tasks' },
    { path: '/clients', icon: Users, label: 'Clients', group: 'Management' },
    { path: '/projects', icon: Folders, label: 'Projects', group: 'Management' },
    { path: '/import-csv', icon: FileSpreadsheet, label: 'Import CSV', group: 'Tools' },
    { path: '/import-json', icon: Database, label: 'Import JSON', group: 'Tools' },
    { path: '/activity-log', icon: History, label: 'Activity Log', group: 'Tools' },
    { path: '/quotes', icon: FileText, label: 'Quotes', group: 'Management' },
    { path: '/integrations/monitors', icon: Activity, label: 'Monitors', group: 'Integrations' },
    { path: '/integrations/status-pages', icon: Globe, label: 'Status Pages', group: 'Integrations' },
    { path: '/settings/company', icon: Building2, label: 'Company Settings', group: 'Settings' },
    { path: '/about', icon: BarChart3, label: 'About', group: 'Other' },
  ];

  const groupedItems = menuItems.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {} as Record<string, typeof menuItems>);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Left Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-16'} bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 flex flex-col fixed h-full z-30`}>
        {/* Logo & Toggle */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
          {isSidebarOpen && (
            <Link to="/" className="flex items-center space-x-2">
              <img src="/logo - Copy.png" alt="Logo" className="h-8 w-auto" />
              <div className="flex flex-col">
                <span className="font-semibold text-sm text-gray-900 dark:text-white">TaskTracker</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">by Cenas-Support</span>
              </div>
            </Link>
          )}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {isSidebarOpen ? (
              <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          {Object.entries(groupedItems).map(([group, items]) => (
            <div key={group} className="mb-4">
              {isSidebarOpen && (
                <h3 className="px-3 mb-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {group}
                </h3>
              )}
              <div className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center ${isSidebarOpen ? 'px-3' : 'px-2 justify-center'} py-2 rounded-md text-sm font-medium transition-colors ${isActive(item.path)}`}
                      title={!isSidebarOpen ? item.label : undefined}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      {isSidebarOpen && <span className="ml-3">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Backup Section */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
          {isSidebarOpen && (
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-3 mb-2">
              Data Management
            </div>
          )}

          <button
            onClick={handleExportBackup}
            disabled={isExporting}
            className={`flex items-center ${isSidebarOpen ? 'px-3' : 'px-2 justify-center'} py-2 w-full text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50`}
            title={!isSidebarOpen ? 'Download Backup' : undefined}
          >
            <Download className="w-5 h-5 flex-shrink-0" />
            {isSidebarOpen && <span className="ml-3">{isExporting ? 'Exporting...' : 'Download Backup'}</span>}
          </button>

          <label className={`flex items-center ${isSidebarOpen ? 'px-3' : 'px-2 justify-center'} py-2 w-full text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer ${isImporting ? 'opacity-50' : ''}`}
            title={!isSidebarOpen ? 'Import Backup' : undefined}>
            <Upload className="w-5 h-5 flex-shrink-0" />
            {isSidebarOpen && <span className="ml-3">{isImporting ? 'Importing...' : 'Import Backup'}</span>}
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              disabled={isImporting}
              className="hidden"
            />
          </label>
        </div>

        {/* New Task Button */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <Link
            to="/add-task"
            className={`flex items-center ${isSidebarOpen ? 'justify-center px-4' : 'justify-center px-2'} py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors`}
          >
            <PlusCircle className="w-5 h-5 flex-shrink-0" />
            {isSidebarOpen && <span className="ml-2">New Task</span>}
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col ${isSidebarOpen ? 'ml-64' : 'ml-16'} transition-all duration-300`}>
        {/* Top Header */}
        <header className="h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks, clients..."
              className="pl-10 pr-4 py-1.5 w-full text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchResults(e.target.value.length > 2);
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (searchQuery.length > 2) setShowSearchResults(true);
              }}
            />

            {/* Search Results Dropdown */}
            {showSearchResults && (searchResults.tasks.length > 0 || searchResults.clients.length > 0 || searchResults.projects.length > 0) && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-md z-50 max-h-96 overflow-y-auto">
                {searchResults.tasks.length > 0 && (
                  <div className="p-2">
                    <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">TASKS</h4>
                    {searchResults.tasks.map(task => {
                      const client = getClient(task.clientId);
                      const project = getProject(task.projectId);
                      return (
                        <Link
                          key={task.id}
                          to={`/edit-task/${task.id}`}
                          state={{ from: location.pathname }}
                          className="block p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm"
                          onClick={() => {
                            setShowSearchResults(false);
                            setSearchQuery('');
                          }}
                        >
                          <div className="font-medium text-gray-900 dark:text-white truncate">{task.description}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{client?.name} • {project?.name}</div>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {searchResults.clients.length > 0 && (
                  <div className="p-2 border-t dark:border-gray-700">
                    <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">CLIENTS</h4>
                    {searchResults.clients.map(client => (
                      <Link
                        key={client.id}
                        to="/clients"
                        className="block p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm"
                        onClick={() => {
                          setShowSearchResults(false);
                          setSearchQuery('');
                        }}
                      >
                        <div className="font-medium text-gray-900 dark:text-white">{client.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">${client.hourlyRate}/hour</div>
                      </Link>
                    ))}
                  </div>
                )}

                {searchResults.projects.length > 0 && (
                  <div className="p-2 border-t dark:border-gray-700">
                    <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">PROJECTS</h4>
                    {searchResults.projects.map(project => {
                      const client = getClient(project.clientId);
                      return (
                        <Link
                          key={project.id}
                          to="/projects"
                          className="block p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm"
                          onClick={() => {
                            setShowSearchResults(false);
                            setSearchQuery('');
                          }}
                        >
                          <div className="font-medium text-gray-900 dark:text-white">{project.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{client?.name}</div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <ThemeToggle />

            {/* User Profile Button */}
            <button
              onClick={() => setShowUserProfile(true)}
              className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              title="User Profile"
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium ${
                currentUser?.role === 'admin' ? 'bg-red-500' : 'bg-blue-500'
              }`}>
                {currentUser?.username?.charAt(0).toUpperCase()}
              </div>
            </button>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              ) : (
                <Menu className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              )}
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="fixed top-0 left-0 bottom-0 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-50 md:hidden overflow-y-auto">
            <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
              <Link to="/" className="flex items-center space-x-2" onClick={() => setIsMobileMenuOpen(false)}>
                <img src="/logo - Copy.png" alt="Logo" className="h-8 w-auto" />
                <div className="flex flex-col">
                  <span className="font-semibold text-sm text-gray-900 dark:text-white">TaskTracker</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">by Cenas-Support</span>
                </div>
              </Link>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <nav className="py-4 px-2">
              {Object.entries(groupedItems).map(([group, items]) => (
                <div key={group} className="mb-4">
                  <h3 className="px-3 mb-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {group}
                  </h3>
                  <div className="space-y-1">
                    {items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${isActive(item.path)}`}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <Icon className="w-5 h-5 flex-shrink-0" />
                          <span className="ml-3">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className="p-3 border-t border-gray-200 dark:border-gray-700">
              <Link
                to="/add-task"
                className="flex items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <PlusCircle className="w-5 h-5 flex-shrink-0" />
                <span className="ml-2">New Task</span>
              </Link>
            </div>
          </div>
        </>
      )}

      {/* User Profile Modal */}
      {showUserProfile && (
        <UserProfile onClose={() => setShowUserProfile(false)} />
      )}

      {/* Quick Task Entry */}
      <QuickTaskEntry />
    </div>
  );
}