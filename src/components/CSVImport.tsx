import React, { useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { parseCSV, transformCSVToTasks, generateImportSummary } from '../utils/csvImport';
import { api } from '../services/api';
import { Task } from '../types';

export function CSVImport() {
  const { clients, projects, reloadTasks } = useApp();
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Partial<Task>[]>([]);
  const [summary, setSummary] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview([]);
      setSummary('');
      setError('');
      setSuccess('');
    }
  };

  const handleProcessFile = async () => {
    if (!file || !selectedClient) {
      setError('Please select a client and upload a CSV file');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const content = await file.text();
      const rows = parseCSV(content);
      const tasks = transformCSVToTasks(rows, selectedClient, selectedProject);

      setPreview(tasks);
      setSummary(generateImportSummary(tasks));
    } catch (err) {
      setError('Error processing CSV file. Please check the file format.');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (preview.length === 0) return;

    setIsImporting(true);
    setError('');
    setSuccess('');

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const task of preview) {
        try {
          await api.createTask(task as Task);
          successCount++;
        } catch (err) {
          errorCount++;
          console.error('Error importing task:', err);
        }
      }

      await reloadTasks();

      setSuccess(`Successfully imported ${successCount} tasks${errorCount > 0 ? ` (${errorCount} failed)` : ''}`);
      setPreview([]);
      setSummary('');
      setFile(null);
    } catch (err) {
      setError('Error importing tasks. Please try again.');
      console.error(err);
    } finally {
      setIsImporting(false);
    }
  };

  const clientProjects = projects.filter(p => p.clientId === selectedClient);
  const selectedClientName = clients.find(c => c.id === selectedClient)?.name;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center mb-6">
            <FileText className="w-6 h-6 text-blue-600 mr-3" />
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Import CSV Data</h1>
          </div>

          <div className="space-y-6">
            {/* Client Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Client *
              </label>
              <select
                value={selectedClient}
                onChange={(e) => {
                  setSelectedClient(e.target.value);
                  setSelectedProject('');
                  setPreview([]);
                  setSummary('');
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                required
              >
                <option value="">Choose a client...</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Project Selection (Optional) */}
            {selectedClient && clientProjects.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Project (Optional)
                </label>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">No specific project</option>
                  {clientProjects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Upload CSV File *
              </label>
              <div className="flex items-center space-x-4">
                <label className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
                    <Upload className="w-5 h-5 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {file ? file.name : 'Choose CSV file...'}
                    </span>
                  </div>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                {file && (
                  <button
                    onClick={() => {
                      setFile(null);
                      setPreview([]);
                      setSummary('');
                    }}
                    className="p-2 text-gray-500 hover:text-red-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Process Button */}
            <button
              onClick={handleProcessFile}
              disabled={!file || !selectedClient || isProcessing}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? 'Processing...' : 'Process CSV File'}
            </button>

            {/* Error Message */}
            {error && (
              <div className="flex items-start p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="flex items-start p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-800 dark:text-green-300">{success}</p>
              </div>
            )}

            {/* Preview Summary */}
            {summary && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
                  Preview Summary
                </h3>
                <pre className="text-xs text-blue-800 dark:text-blue-400 whitespace-pre-wrap font-mono">
                  {summary}
                </pre>
              </div>
            )}

            {/* Preview Table */}
            {preview.length > 0 && (
              <>
                <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="max-h-96 overflow-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Description</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Hours</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Cost</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {preview.slice(0, 20).map((task, index) => (
                          <tr key={index}>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">{task.date}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                task.type === 'incident' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
                                task.type === 'insumos' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400' :
                                'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                              }`}>
                                {task.type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white truncate max-w-xs">{task.description}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">{task.hours?.toFixed(2) || '0.00'}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">${task.cost?.toFixed(2) || '0.00'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {preview.length > 20 && (
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 text-sm text-gray-600 dark:text-gray-400">
                      Showing first 20 of {preview.length} tasks
                    </div>
                  )}
                </div>

                {/* Import Button */}
                <button
                  onClick={handleImport}
                  disabled={isImporting}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isImporting ? 'Importing...' : `Import ${preview.length} Tasks to ${selectedClientName}`}
                </button>
              </>
            )}

            {/* Instructions */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                CSV Format Instructions
              </h3>
              <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Expected columns: Date, Duration, Price, Customer, Activity, Description</li>
                <li>• Date formats supported: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY (e.g., 2025-01-25, 01/25/2025, or 25/01/2025)</li>
                <li>• Duration format: H:MM (e.g., 2:30 for 2.5 hours)</li>
                <li>• Activity types: "Incidentes IT", "Solicitudes IT", "Gestión de Servicios IT", "Consultoría IT", "Consultoría Web", "Adquisiciones"</li>
                <li>• All imported tasks will be marked as completed</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
