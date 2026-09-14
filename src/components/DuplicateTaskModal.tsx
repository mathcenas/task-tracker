import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Copy, X, Plus, Trash2 } from 'lucide-react';
import { Task } from '../types';

interface DuplicateTaskModalProps {
  task: Task;
  onClose: () => void;
}

interface TargetRow {
  key: string;
  clientId: string;
  projectId: string;
}

const newRow = (): TargetRow => ({ key: crypto.randomUUID(), clientId: '', projectId: '' });

export function DuplicateTaskModal({ task, onClose }: DuplicateTaskModalProps) {
  const { clients, projects, addTask } = useApp();
  const activeClients = clients.filter(c => !c.archived);
  const [date, setDate] = useState(task.date);
  const [rows, setRows] = useState<TargetRow[]>([newRow()]);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const updateRow = (key: string, patch: Partial<TargetRow>) => {
    setRows(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r));
  };

  const removeRow = (key: string) => setRows(prev => prev.filter(r => r.key !== key));

  const validRows = rows.filter(r => r.clientId && r.projectId);

  const handleSubmit = async () => {
    if (validRows.length === 0 || !date) return;
    setIsSaving(true);
    const newErrors: string[] = [];

    for (const row of validRows) {
      try {
        await addTask({
          clientId: row.clientId,
          projectId: row.projectId,
          description: task.description,
          hours: task.hours,
          cost: task.cost,
          date,
          type: task.type,
          status: task.status,
          priority: task.priority,
          finished: task.finished,
          notes: task.notes,
          completedAt: task.completedAt,
          assignedTo: task.assignedTo,
        });
      } catch (err) {
        const clientName = clients.find(c => c.id === row.clientId)?.name || row.clientId;
        newErrors.push(`${clientName}: ${err instanceof Error ? err.message.replace('DUPLICATE: ', '') : 'Failed to create task'}`);
      }
    }

    setIsSaving(false);
    setErrors(newErrors);
    if (newErrors.length === 0) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-xl">
        <div className="rounded-xl bg-white dark:bg-gray-800 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Copy className="w-5 h-5 text-cyan-500" />
              Duplicate to Other Clients
            </h3>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-4">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm">
              <p className="text-gray-900 dark:text-white font-medium">{task.description}</p>
              <p className="text-gray-500 dark:text-gray-400 mt-1 capitalize">
                {task.type}
                {task.hours ? ` • ${task.hours}h` : ''}
                {task.cost ? ` • $${task.cost}` : ''}
                {` • ${task.priority} priority`}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Description, type, hours/cost and priority stay the same for every copy.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:ring-cyan-500 focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Clients ({validRows.length} ready)
              </label>
              <div className="space-y-2">
                {rows.map((row) => {
                  const rowProjects = row.clientId ? projects.filter(p => p.clientId === row.clientId) : [];
                  return (
                    <div key={row.key} className="flex gap-2">
                      <select
                        value={row.clientId}
                        onChange={(e) => updateRow(row.key, { clientId: e.target.value, projectId: '' })}
                        className="flex-1 rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:ring-cyan-500 focus:border-cyan-500"
                      >
                        <option value="">Select client...</option>
                        {activeClients.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <select
                        value={row.projectId}
                        onChange={(e) => updateRow(row.key, { projectId: e.target.value })}
                        disabled={!row.clientId}
                        className="flex-1 rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-50"
                      >
                        <option value="">Select project...</option>
                        {rowProjects.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => removeRow(row.key)}
                        disabled={rows.length === 1}
                        className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => setRows(prev => [...prev, newRow()])}
                className="mt-2 inline-flex items-center gap-1 text-sm text-cyan-600 dark:text-cyan-400 hover:underline"
              >
                <Plus className="w-4 h-4" /> Add another client
              </button>
            </div>

            {errors.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300 space-y-1">
                {errors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}
          </div>

          <div className="flex gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
            <button
              onClick={handleSubmit}
              disabled={isSaving || validRows.length === 0 || !date}
              className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              {isSaving ? 'Creating...' : `Create ${validRows.length} Task${validRows.length !== 1 ? 's' : ''}`}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
