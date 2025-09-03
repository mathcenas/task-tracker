import React from 'react';
import { Clock, CheckSquare, BookTemplate as Template, Repeat, CalendarDays, Users, Folders, BarChart3, Download, Search, Moon, Sun, Smartphone, Globe, Shield, Zap, TrendingUp, FileText, Package, AlertTriangle, Calendar, DollarSign, Target, Plus, Pencil, Trash2, Copy, ExternalLink } from 'lucide-react';

export function AboutPage() {
  const features = [
    {
      category: "Core Dashboard Features",
      icon: <BarChart3 className="w-6 h-6 text-blue-500" />,
      items: [
        {
          name: "Weekly Dashboard",
          description: "Real-time overview of current week's completed tasks, revenue, and pending work",
          icon: <Clock className="w-5 h-5 text-blue-500" />,
          details: ["Hours tracking", "Revenue calculation", "Priority task highlighting", "Completion rate metrics"]
        },
        {
          name: "Monthly Dashboard", 
          description: "Comprehensive monthly view with detailed analytics and export capabilities",
          icon: <Calendar className="w-5 h-5 text-green-500" />,
          details: ["Monthly statistics", "Task breakdown", "Revenue analysis", "Historical data"]
        },
        {
          name: "Client Management",
          description: "Complete client database with project tracking and billing rates",
          icon: <Users className="w-5 h-5 text-purple-500" />,
          details: ["Client profiles", "Hourly rates", "Contact information", "Unique slug generation"]
        },
        {
          name: "Project Organization",
          description: "Project-based task organization with status tracking and progress monitoring",
          icon: <Folders className="w-5 h-5 text-orange-500" />,
          details: ["Project status tracking", "Task grouping", "Progress visualization", "Client association"]
        }
      ]
    },
    {
      category: "Advanced Workflow Features",
      icon: <Zap className="w-6 h-6 text-yellow-500" />,
      items: [
        {
          name: "Bulk Task Operations",
          description: "Efficiently manage multiple tasks simultaneously with powerful bulk actions",
          icon: <CheckSquare className="w-5 h-5 text-blue-500" />,
          details: [
            "Select multiple tasks with checkboxes",
            "Bulk complete with automatic 1-hour default",
            "Bulk reschedule to new dates",
            "Bulk delete with confirmation",
            "Revenue estimation for selected tasks",
            "Smart selection (Select All/Deselect All)"
          ]
        },
        {
          name: "Task Templates",
          description: "Pre-built and custom templates for common recurring work types",
          icon: <Template className="w-5 h-5 text-green-500" />,
          details: [
            "Pre-built templates: Server Monitoring, Security Updates, Backup Verification",
            "Critical incident templates: Website Down, SSL Certificate Renewal",
            "Performance templates: Database Optimization",
            "Supply templates: Server Hardware",
            "Custom template creation with categories",
            "One-click template usage",
            "Estimated hours and costs included"
          ]
        },
        {
          name: "Recurring Tasks Manager",
          description: "Automated monthly maintenance tasks with smart scheduling",
          icon: <Repeat className="w-5 h-5 text-purple-500" />,
          details: [
            "Auto-generates overdue recurring tasks",
            "Flexible day-of-month scheduling",
            "Active/Inactive toggle for seasonal tasks",
            "Pre-configured maintenance tasks:",
            "  • Server monitoring (1st of month)",
            "  • Security updates (15th of month)", 
            "  • Backup verification (28th of month)",
            "Custom recurring task creation",
            "Next due date tracking",
            "Generation history logging"
          ]
        },
        {
          name: "Calendar Integration",
          description: "Seamless calendar sync with multiple platforms and export options",
          icon: <CalendarDays className="w-5 h-5 text-indigo-500" />,
          details: [
            "Export to .ics files for any calendar app",
            "Direct Google Calendar integration",
            "Direct Outlook Calendar integration", 
            "Filter options: All, Pending, Completed tasks",
            "Calendar subscription URL (future feature)",
            "Task preview before export",
            "Automatic event categorization"
          ]
        }
      ]
    },
    {
      category: "Task Management System",
      icon: <Target className="w-6 h-6 text-red-500" />,
      items: [
        {
          name: "Task Types & Categories",
          description: "Comprehensive task classification system for different work types",
          icon: <FileText className="w-5 h-5 text-blue-500" />,
          details: [
            "Incident tasks (urgent issues) - Red indicators",
            "Request tasks (regular work) - Blue indicators", 
            "Supplies/Insumos (materials/costs) - Purple indicators",
            "Priority levels: High, Medium, Low",
            "Status tracking: Pending, In-Progress, Completed, Cancelled",
            "Automatic completion for supply items"
          ]
        },
        {
          name: "Smart Task Completion",
          description: "Intelligent task completion with modal dialogs and validation",
          icon: <CheckSquare className="w-5 h-5 text-green-500" />,
          details: [
            "Completion modal with hour entry",
            "Automatic marking for supply items",
            "Task description preview in modal",
            "Validation for required fields",
            "Instant revenue calculation"
          ]
        },
        {
          name: "Task Editing & Management",
          description: "Full CRUD operations with comprehensive task editing capabilities",
          icon: <Pencil className="w-5 h-5 text-orange-500" />,
          details: [
            "Complete task editing interface",
            "Delete tasks with confirmation",
            "Status and priority updates",
            "Notes and additional details",
            "Date rescheduling",
            "Client and project reassignment"
          ]
        }
      ]
    },
    {
      category: "Client Experience & Reporting",
      icon: <Globe className="w-6 h-6 text-green-500" />,
      items: [
        {
          name: "Public Client Dashboard",
          description: "Clean, professional client-only interface with no admin features visible",
          icon: <Globe className="w-5 h-5 text-blue-500" />,
          details: [
            "Simple URLs: /report/client-name/year/month",
            "Client-focused interface (no admin navigation)",
            "Monthly statistics and performance metrics",
            "6-month trend visualization",
            "Professional presentation suitable for clients",
            "Month navigation for historical data"
          ]
        },
        {
          name: "PDF Report Generation",
          description: "Professional PDF reports with company branding and detailed breakdowns",
          icon: <Download className="w-5 h-5 text-red-500" />,
          details: [
            "Company-branded headers with logo",
            "Detailed service and supply tables",
            "Financial summaries and totals",
            "Professional formatting",
            "Automatic filename generation",
            "Client-ready presentation"
          ]
        },
        {
          name: "Revenue & Analytics",
          description: "Comprehensive financial tracking and business intelligence",
          icon: <TrendingUp className="w-5 h-5 text-green-500" />,
          details: [
            "Real-time revenue calculation",
            "Service vs. supply cost tracking",
            "Client profitability analysis",
            "6-month performance trends",
            "Hourly rate application",
            "Completion rate metrics"
          ]
        }
      ]
    },
    {
      category: "User Interface & Experience",
      icon: <Smartphone className="w-6 h-6 text-purple-500" />,
      items: [
        {
          name: "Modern Design System",
          description: "Apple-level design aesthetics with thoughtful micro-interactions",
          icon: <Smartphone className="w-5 h-5 text-blue-500" />,
          details: [
            "Responsive design for all devices",
            "Dark/Light theme toggle",
            "Smooth animations and transitions",
            "Hover states and micro-interactions",
            "Consistent 8px spacing system",
            "Professional color palette"
          ]
        },
        {
          name: "Smart Search & Navigation",
          description: "Intelligent search across tasks, clients, and projects",
          icon: <Search className="w-5 h-5 text-purple-500" />,
          details: [
            "Global search bar in navigation",
            "Search tasks, clients, and projects",
            "Real-time search results dropdown",
            "Quick navigation to search results",
            "Mobile-responsive search interface"
          ]
        },
        {
          name: "Quick Actions & Shortcuts",
          description: "Streamlined workflows with quick access to common actions",
          icon: <Zap className="w-5 h-5 text-yellow-500" />,
          details: [
            "Quick Actions bar on dashboard",
            "Template quick-fill buttons",
            "Priority task highlighting",
            "One-click task completion",
            "Keyboard-friendly interface"
          ]
        }
      ]
    },
    {
      category: "Data Management & Security",
      icon: <Shield className="w-6 h-6 text-green-500" />,
      items: [
        {
          name: "Local Data Storage",
          description: "Secure browser-based data storage with automatic persistence",
          icon: <Shield className="w-5 h-5 text-green-500" />,
          details: [
            "LocalStorage-based persistence",
            "Automatic data backup on changes",
            "Sample data generation for new users",
            "Data integrity validation",
            "No external dependencies required"
          ]
        },
        {
          name: "Smart Data Relationships",
          description: "Intelligent data linking and relationship management",
          icon: <Target className="w-5 h-5 text-indigo-500" />,
          details: [
            "Client-Project-Task hierarchy",
            "Automatic slug generation for URLs",
            "Unique ID generation",
            "Data consistency validation",
            "Relationship integrity maintenance"
          ]
        }
      ]
    }
  ];

  const stats = {
    totalFeatures: features.reduce((sum, category) => sum + category.items.length, 0),
    categories: features.length,
    implementations: [
      "React 18 with TypeScript",
      "Tailwind CSS for styling", 
      "React Router for navigation",
      "Date-fns for date handling",
      "jsPDF for report generation",
      "Lucide React for icons"
    ]
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-lg p-8 dark:bg-gray-800">
        <div className="text-center">
          <div className="flex items-center justify-center w-16 h-16 bg-blue-600 rounded-lg mx-auto mb-6">
            <Clock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">TaskTracker Pro</h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
            Professional task management and client reporting system
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-blue-50 p-4 rounded-lg dark:bg-blue-900/20">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.totalFeatures}</p>
              <p className="text-sm text-blue-600 dark:text-blue-400">Features Implemented</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg dark:bg-green-900/20">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.categories}</p>
              <p className="text-sm text-green-600 dark:text-green-400">Feature Categories</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg dark:bg-purple-900/20">
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">100%</p>
              <p className="text-sm text-purple-600 dark:text-purple-400">Production Ready</p>
            </div>
          </div>
        </div>
      </div>

      {/* Technology Stack */}
      <div className="bg-white rounded-lg shadow-lg p-6 dark:bg-gray-800">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <Zap className="w-5 h-5 text-yellow-500 mr-2" />
          Technology Stack
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {stats.implementations.map((tech, index) => (
            <div key={index} className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg dark:bg-gray-700">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-700 dark:text-gray-300">{tech}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Feature Categories */}
      {features.map((category, categoryIndex) => (
        <div key={categoryIndex} className="bg-white rounded-lg shadow-lg p-6 dark:bg-gray-800">
          <div className="flex items-center space-x-3 mb-6">
            {category.icon}
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {category.category}
            </h2>
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium dark:bg-blue-900 dark:text-blue-200">
              {category.items.length} features
            </span>
          </div>
          
          <div className="grid gap-6">
            {category.items.map((feature, featureIndex) => (
              <div key={featureIndex} className="border rounded-lg p-4 hover:shadow-md transition-all duration-200 dark:border-gray-700">
                <div className="flex items-start space-x-3 mb-3">
                  {feature.icon}
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                      {feature.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                      {feature.description}
                    </p>
                  </div>
                </div>
                
                <div className="ml-8">
                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                    Key Features:
                  </h4>
                  <ul className="space-y-1">
                    {feature.details.map((detail, detailIndex) => (
                      <li key={detailIndex} className="flex items-start space-x-2 text-sm text-gray-600 dark:text-gray-300">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Implementation Timeline */}
      <div className="bg-white rounded-lg shadow-lg p-6 dark:bg-gray-800">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
          <Calendar className="w-5 h-5 text-blue-500 mr-2" />
          Development Timeline
        </h2>
        
        <div className="space-y-4">
          <div className="flex items-center space-x-4 p-4 bg-green-50 rounded-lg dark:bg-green-900/20">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <div className="flex-1">
              <h4 className="font-medium text-green-900 dark:text-green-300">Phase 1: Core Foundation</h4>
              <p className="text-sm text-green-700 dark:text-green-400">
                Basic task management, client system, and dashboard implementation
              </p>
            </div>
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">✅ Complete</span>
          </div>
          
          <div className="flex items-center space-x-4 p-4 bg-green-50 rounded-lg dark:bg-green-900/20">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <div className="flex-1">
              <h4 className="font-medium text-green-900 dark:text-green-300">Phase 2: Advanced Workflows</h4>
              <p className="text-sm text-green-700 dark:text-green-400">
                Bulk operations, templates, recurring tasks, and calendar integration
              </p>
            </div>
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">✅ Complete</span>
          </div>
          
          <div className="flex items-center space-x-4 p-4 bg-green-50 rounded-lg dark:bg-green-900/20">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <div className="flex-1">
              <h4 className="font-medium text-green-900 dark:text-green-300">Phase 3: Client Experience</h4>
              <p className="text-sm text-green-700 dark:text-green-400">
                Public client dashboard, PDF reports, and professional presentation
              </p>
            </div>
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">✅ Complete</span>
          </div>
          
          <div className="flex items-center space-x-4 p-4 bg-blue-50 rounded-lg dark:bg-blue-900/20">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <div className="flex-1">
              <h4 className="font-medium text-blue-900 dark:text-blue-300">Future Enhancements</h4>
              <p className="text-sm text-blue-700 dark:text-blue-400">
                Email notifications, mobile app, advanced analytics, and integrations
              </p>
            </div>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">📋 Planned</span>
          </div>
        </div>
      </div>

      {/* Usage Statistics */}
      <div className="bg-white rounded-lg shadow-lg p-6 dark:bg-gray-800">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
          <BarChart3 className="w-5 h-5 text-purple-500 mr-2" />
          System Capabilities
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg dark:bg-blue-900/20">
            <FileText className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <p className="text-lg font-bold text-blue-900 dark:text-blue-300">Unlimited</p>
            <p className="text-xs text-blue-600 dark:text-blue-400">Tasks & Projects</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg dark:bg-green-900/20">
            <Users className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-lg font-bold text-green-900 dark:text-green-300">Unlimited</p>
            <p className="text-xs text-green-600 dark:text-green-400">Clients</p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg dark:bg-purple-900/20">
            <Template className="w-8 h-8 text-purple-500 mx-auto mb-2" />
            <p className="text-lg font-bold text-purple-900 dark:text-purple-300">Custom</p>
            <p className="text-xs text-purple-600 dark:text-purple-400">Templates</p>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg dark:bg-orange-900/20">
            <Repeat className="w-8 h-8 text-orange-500 mx-auto mb-2" />
            <p className="text-lg font-bold text-orange-900 dark:text-orange-300">Automated</p>
            <p className="text-xs text-orange-600 dark:text-orange-400">Recurring Tasks</p>
          </div>
        </div>
      </div>

      {/* Quick Start Guide */}
      <div className="bg-white rounded-lg shadow-lg p-6 dark:bg-gray-800">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
          <Target className="w-5 h-5 text-green-500 mr-2" />
          Quick Start Guide
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">Getting Started</h3>
            <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li className="flex items-start space-x-2">
                <span className="flex items-center justify-center w-5 h-5 bg-blue-100 text-blue-600 rounded-full text-xs font-medium dark:bg-blue-900 dark:text-blue-300">1</span>
                <span>Add your first client in the Clients section</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="flex items-center justify-center w-5 h-5 bg-blue-100 text-blue-600 rounded-full text-xs font-medium dark:bg-blue-900 dark:text-blue-300">2</span>
                <span>Create projects for organizing work</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="flex items-center justify-center w-5 h-5 bg-blue-100 text-blue-600 rounded-full text-xs font-medium dark:bg-blue-900 dark:text-blue-300">3</span>
                <span>Start adding tasks using templates or custom entries</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="flex items-center justify-center w-5 h-5 bg-blue-100 text-blue-600 rounded-full text-xs font-medium dark:bg-blue-900 dark:text-blue-300">4</span>
                <span>Set up recurring tasks for maintenance</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="flex items-center justify-center w-5 h-5 bg-blue-100 text-blue-600 rounded-full text-xs font-medium dark:bg-blue-900 dark:text-blue-300">5</span>
                <span>Share client report URLs for transparency</span>
              </li>
            </ol>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">Pro Tips</h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li className="flex items-start space-x-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2"></div>
                <span>Use templates for consistent task descriptions</span>
              </li>
              <li className="flex items-start space-x-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2"></div>
                <span>Set up recurring tasks for regular maintenance</span>
              </li>
              <li className="flex items-start space-x-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2"></div>
                <span>Use bulk operations for efficiency</span>
              </li>
              <li className="flex items-start space-x-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2"></div>
                <span>Export calendars to stay organized</span>
              </li>
              <li className="flex items-start space-x-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2"></div>
                <span>Share client URLs for transparency</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Detailed Features */}
      {features.map((category, categoryIndex) => (
        <div key={categoryIndex} className="bg-white rounded-lg shadow-lg p-6 dark:bg-gray-800">
          <div className="flex items-center space-x-3 mb-6">
            {category.icon}
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {category.category}
            </h2>
          </div>
          
          <div className="space-y-6">
            {category.items.map((feature, featureIndex) => (
              <div key={featureIndex} className="border-l-4 border-blue-500 pl-4 py-2">
                <div className="flex items-start space-x-3 mb-3">
                  {feature.icon}
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {feature.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                      {feature.description}
                    </p>
                  </div>
                </div>
                
                <div className="ml-8">
                  <div className="grid gap-2">
                    {feature.details.map((detail, detailIndex) => (
                      <div key={detailIndex} className="flex items-start space-x-2">
                        <div className="w-1 h-1 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-sm text-gray-600 dark:text-gray-300">{detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Footer */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 dark:from-blue-900/20 dark:to-purple-900/20">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            TaskTracker Pro - Production Ready
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            A comprehensive task management system built with modern web technologies
          </p>
          <div className="flex justify-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
            <span>Built with React 18</span>
            <span>•</span>
            <span>TypeScript</span>
            <span>•</span>
            <span>Tailwind CSS</span>
            <span>•</span>
            <span>Responsive Design</span>
          </div>
        </div>
      </div>
    </div>
  );
}