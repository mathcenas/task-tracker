import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, PlusCircle, Clock, Calendar, Folders, Menu, X, Search, BarChart3, CheckSquare } from 'lucide-react';
import { ThemeToggle } from './ui/ThemeToggle';
import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { tasks, clients, projects, getClient, getProject } = useApp();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  
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
      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' 
      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white shadow-lg dark:bg-gray-800 dark:border-b dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16">
            <div className="flex space-x-8">
              <Link to="/" className="flex items-center space-x-2 text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
                <div className="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-lg">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-lg">TaskTracker Pro</span>
              </Link>
              
              <div className="hidden md:flex items-center space-x-4">
                <Link 
                  to="/" 
                  className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive('/')}`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Weekly</span>
                </Link>
                <Link 
                  to="/monthly" 
                  className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive('/monthly')}`}
                >
                  <Calendar className="w-4 h-4" />
                  <span>Monthly</span>
                </Link>
                <Link 
                  to="/tasks" 
                  className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive('/tasks')}`}
                >
                  <CheckSquare className="w-4 h-4" />
                  <span>All Tasks</span>
                </Link>
                <Link 
                  to="/clients" 
                  className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive('/clients')}`}
                >
                  <Users className="w-4 h-4" />
                  <span>Clients</span>
                </Link>
                <Link 
                  to="/projects" 
                  className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive('/projects')}`}
                >
                  <Folders className="w-4 h-4" />
                  <span>Projects</span>
                </Link>
                <Link 
                  to="/about" 
                  className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive('/about')}`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>About</span>
                </Link>
                <Link 
                  to="/add-task" 
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-all duration-200`}
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>New Task</span>
                </Link>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Search Bar */}
              <div className="relative hidden md:block">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search tasks, clients..."
                    className="pl-10 pr-4 py-2 w-64 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
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
                </div>
                
                {/* Search Results Dropdown */}
                {showSearchResults && (searchResults.tasks.length > 0 || searchResults.clients.length > 0 || searchResults.projects.length > 0) && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
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
              
              <ThemeToggle />
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                ) : (
                  <Menu className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                )}
              </button>
            </div>
          </div>
          
          {/* Mobile menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden border-t dark:border-gray-700">
              <div className="px-2 pt-2 pb-3 space-y-1">
                <Link 
                  to="/" 
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive('/')}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Weekly Dashboard</span>
                </Link>
                <Link 
                  to="/monthly" 
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive('/monthly')}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Calendar className="w-4 h-4" />
                  <span>Monthly Dashboard</span>
                </Link>
                <Link 
                  to="/tasks" 
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive('/tasks')}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <CheckSquare className="w-4 h-4" />
                  <span>All Tasks</span>
                </Link>
                <Link 
                  to="/clients" 
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive('/clients')}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Users className="w-4 h-4" />
                  <span>Clients</span>
                </Link>
                <Link 
                  to="/projects" 
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive('/projects')}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Folders className="w-4 h-4" />
                  <span>Projects</span>
                </Link>
                <Link 
                  to="/about" 
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive('/about')}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>About</span>
                </Link>
                <Link 
                  to="/add-task" 
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-all duration-200"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>New Task</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}