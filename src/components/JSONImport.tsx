import React, { useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, X, Database } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

interface BackupData {
  exportDate: string;
  version: string;
  metadata?: {
    totalClients: number;
    totalProjects: number;
    totalTasks: number;
    totalRecurringTasks: number;
    totalTaskTemplates: number;
  };
  data?: {
    clients: any[];
    projects: any[];
    tasks: any[];
    recurringTasks: any[];
    taskTemplates: any[];
  };
  clients?: any[];
  projects?: any[];
  tasks?: any[];
  recurringTasks?: any[];
  taskTemplates?: any[];
}

export function JSONImport() {
  const { reloadClients, reloadProjects, reloadTasks } = useApp();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BackupData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [importProgress, setImportProgress] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(null);
      setError('');
      setSuccess('');
    }
  };

  const handleProcessFile = async () => {
    if (!file) {
      setError('Please upload a JSON backup file');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const content = await file.text();
      const data = JSON.parse(content) as BackupData;

      const clients = data.clients || data.data?.clients || [];
      const projects = data.projects || data.data?.projects || [];
      const tasks = data.tasks || data.data?.tasks || [];
      const recurringTasks = data.recurringTasks || data.data?.recurringTasks || [];
      const taskTemplates = data.taskTemplates || data.data?.taskTemplates || [];

      const normalizedData: BackupData = {
        exportDate: data.exportDate,
        version: data.version,
        metadata: data.metadata || {
          totalClients: clients.length,
          totalProjects: projects.length,
          totalTasks: tasks.length,
          totalRecurringTasks: recurringTasks.length,
          totalTaskTemplates: taskTemplates.length,
        },
        clients,
        projects,
        tasks,
        recurringTasks,
        taskTemplates
      };

      setPreview(normalizedData);
    } catch (err) {
      setError('Error processing JSON file. Please check the file format.');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!preview) return;

    setIsImporting(true);
    setError('');
    setSuccess('');
    setImportProgress('');

    try {
      let clientsImported = 0;
      let projectsImported = 0;
      let tasksImported = 0;
      let recurringTasksImported = 0;
      let templatesImported = 0;

      const clients = preview.clients || [];
      const projects = preview.projects || [];
      const tasks = preview.tasks || [];
      const recurringTasks = preview.recurringTasks || [];
      const taskTemplates = preview.taskTemplates || [];

      setImportProgress('Importing clients...');
      for (const client of clients) {
        try {
          await api.createClient(client);
          clientsImported++;
        } catch (err) {
          console.error('Error importing client:', err);
        }
      }

      setImportProgress('Importing projects...');
      for (const project of projects) {
        try {
          await api.createProject(project);
          projectsImported++;
        } catch (err) {
          console.error('Error importing project:', err);
        }
      }

      setImportProgress('Importing tasks...');
      for (const task of tasks) {
        try {
          await api.createTask(task);
          tasksImported++;
        } catch (err) {
          console.error('Error importing task:', err);
        }
      }

      setImportProgress('Importing recurring tasks...');
      for (const recurringTask of recurringTasks) {
        try {
          await api.createRecurringTask(recurringTask);
          recurringTasksImported++;
        } catch (err) {
          console.error('Error importing recurring task:', err);
        }
      }

      setImportProgress('Importing task templates...');
      for (const template of taskTemplates) {
        try {
          await api.createTaskTemplate(template);
          templatesImported++;
        } catch (err) {
          console.error('Error importing template:', err);
        }
      }

      setImportProgress('Reloading data...');
      await Promise.all([reloadClients(), reloadProjects(), reloadTasks()]);

      setSuccess(
        `Successfully imported: ${clientsImported} clients, ${projectsImported} projects, ` +
        `${tasksImported} tasks, ${recurringTasksImported} recurring tasks, ${templatesImported} templates`
      );
      setPreview(null);
      setFile(null);
      setImportProgress('');
    } catch (err) {
      setError('Error importing backup. Please try again.');
      console.error(err);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center mb-6">
            <Database className="w-6 h-6 text-blue-600 mr-3" />
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Import JSON Backup</h1>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Upload JSON Backup File
              </label>
              <div className="flex items-center space-x-4">
                <label className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
                    <Upload className="w-5 h-5 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {file ? file.name : 'Choose JSON backup file...'}
                    </span>
                  </div>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                {file && (
                  <button
                    onClick={() => {
                      setFile(null);
                      setPreview(null);
                    }}
                    className="p-2 text-gray-500 hover:text-red-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={handleProcessFile}
              disabled={!file || isProcessing}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? 'Processing...' : 'Process Backup File'}
            </button>

            {error && (
              <div className="flex items-start p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
              </div>
            )}

            {success && (
              <div className="flex items-start p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-800 dark:text-green-300">{success}</p>
              </div>
            )}

            {importProgress && (
              <div className="flex items-start p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
                <p className="text-sm text-blue-800 dark:text-blue-300">{importProgress}</p>
              </div>
            )}

            {preview && (
              <>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
                    Backup Preview
                  </h3>
                  <div className="space-y-2 text-sm text-blue-800 dark:text-blue-400">
                    <p><strong>Export Date:</strong> {new Date(preview.exportDate).toLocaleString()}</p>
                    <p><strong>Version:</strong> {preview.version}</p>
                    <div className="mt-3 space-y-1">
                      <p><strong>Contents:</strong></p>
                      <ul className="ml-4 space-y-1">
                        <li>• {preview.metadata?.totalClients || preview.clients?.length || 0} clients</li>
                        <li>• {preview.metadata?.totalProjects || preview.projects?.length || 0} projects</li>
                        <li>• {preview.metadata?.totalTasks || preview.tasks?.length || 0} tasks</li>
                        <li>• {preview.metadata?.totalRecurringTasks || preview.recurringTasks?.length || 0} recurring tasks</li>
                        <li>• {preview.metadata?.totalTaskTemplates || preview.taskTemplates?.length || 0} task templates</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleImport}
                  disabled={isImporting}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isImporting ? 'Importing...' : 'Import All Data'}
                </button>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-yellow-900 dark:text-yellow-300 mb-2">
                    Warning
                  </h3>
                  <p className="text-xs text-yellow-800 dark:text-yellow-400">
                    This will import all data from the backup file. If there are duplicate entries, they will be added again. Make sure you understand the impact before proceeding.
                  </p>
                </div>
              </>
            )}

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                JSON Backup Format
              </h3>
              <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <li>• This tool imports JSON backup files exported from the system</li>
                <li>• The backup file should contain clients, projects, tasks, recurring tasks, and templates</li>
                <li>• All data will be imported in the order: clients, projects, tasks, recurring tasks, templates</li>
                <li>• The import process may take a few minutes for large backups</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
