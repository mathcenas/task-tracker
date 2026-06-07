import React, { useState, useRef } from 'react';
import { Upload, X, Trash2, CreditCard as Edit3, CheckCircle2, AlertTriangle, FileCode, Loader2 } from 'lucide-react';
import { parseMarkdownReport, diffAgainstOriginal } from '../utils/markdownImport';
import { useApp } from '../context/AppContext';
import type { Task } from '../types';

interface Props {
  tasks: Task[];
  onClose: () => void;
  onApplied: () => void;
}

type ApplyState = 'idle' | 'applying' | 'done';

export function MarkdownImportModal({ tasks, onClose, onApplied }: Props) {
  const { updateTask, deleteTask } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);

  const [diff, setDiff] = useState<ReturnType<typeof diffAgainstOriginal> | null>(null);
  const [filename, setFilename] = useState('');
  const [applyState, setApplyState] = useState<ApplyState>('idle');
  const [error, setError] = useState('');
  const [selectedRemovals, setSelectedRemovals] = useState<Set<string>>(new Set());

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      const content = ev.target?.result as string;
      try {
        const parsed = parseMarkdownReport(content);
        if (parsed.length === 0) {
          setError('No task rows with an ID column found. Make sure you exported this report from TaskTracker Pro.');
          setDiff(null);
          return;
        }
        const result = diffAgainstOriginal(tasks, parsed);
        setDiff(result);
        setSelectedRemovals(new Set(result.removed));
      } catch (err: any) {
        setError(`Failed to parse file: ${err.message}`);
        setDiff(null);
      }
    };
    reader.readAsText(file);
  };

  const toggleRemoval = (shortId: string) => {
    setSelectedRemovals(prev => {
      const next = new Set(prev);
      next.has(shortId) ? next.delete(shortId) : next.add(shortId);
      return next;
    });
  };

  const findTask = (shortId: string) => tasks.find(t => t.id.slice(-8) === shortId);

  const hasChanges = diff && (selectedRemovals.size > 0 || diff.modified.length > 0);

  const handleApply = async () => {
    if (!diff) return;
    setApplyState('applying');
    try {
      for (const shortId of selectedRemovals) {
        const task = findTask(shortId);
        if (task) await deleteTask(task.id);
      }

      for (const { shortId, changes } of diff.modified) {
        const task = findTask(shortId);
        if (!task) continue;
        await updateTask({ ...task, ...changes });
      }

      setApplyState('done');
      setTimeout(() => { onApplied(); onClose(); }, 1200);
    } catch (err: any) {
      setError(`Failed to apply changes: ${err.message}`);
      setApplyState('idle');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-teal-500" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Import Markdown Report</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* File picker */}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/10 transition-all"
          >
            <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
            {filename
              ? <p className="text-sm font-medium text-teal-700 dark:text-teal-300">{filename}</p>
              : <>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Click to choose a .md file</p>
                  <p className="text-xs text-gray-400 mt-1">Must be a report exported from TaskTracker Pro</p>
                </>
            }
            <input ref={fileRef} type="file" accept=".md,text/markdown" className="hidden" onChange={handleFile} />
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {diff && (
            <div className="space-y-4">
              {/* Stats bar */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                  <p className="text-lg font-bold text-red-700 dark:text-red-400">{diff.removed.length}</p>
                  <p className="text-xs text-red-500">to remove</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                  <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{diff.modified.length}</p>
                  <p className="text-xs text-amber-500">to update</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                  <p className="text-lg font-bold text-green-700 dark:text-green-400">{diff.unchanged.length}</p>
                  <p className="text-xs text-green-500">unchanged</p>
                </div>
              </div>

              {/* Removals */}
              {diff.removed.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Trash2 className="w-4 h-4 text-red-500" />
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Tasks to delete</p>
                    <span className="text-xs text-gray-400">(uncheck to keep)</span>
                  </div>
                  <div className="space-y-1.5">
                    {diff.removed.map(shortId => {
                      const task = findTask(shortId);
                      const checked = selectedRemovals.has(shortId);
                      return (
                        <label key={shortId} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          checked
                            ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 opacity-60'
                        }`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRemoval(shortId)}
                            className="mt-0.5 accent-red-500"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {task?.description || shortId}
                            </p>
                            {task && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                {task.date} · {task.type} · {task.hours != null ? `${task.hours}h` : task.cost != null ? `$${task.cost}` : '—'}
                              </p>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Modifications */}
              {diff.modified.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Edit3 className="w-4 h-4 text-amber-500" />
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Tasks to update</p>
                    <span className="text-xs text-gray-400">(all will be applied)</span>
                  </div>
                  <div className="space-y-2">
                    {diff.modified.map(({ shortId, changes }) => {
                      const task = findTask(shortId);
                      return (
                        <div key={shortId} className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate mb-1.5">
                            {task?.description || shortId}
                          </p>
                          <div className="space-y-1">
                            {changes.description !== undefined && (
                              <div className="text-xs">
                                <span className="text-gray-400">description: </span>
                                <span className="line-through text-red-500 dark:text-red-400">{task?.description}</span>
                                <span className="text-gray-400"> → </span>
                                <span className="text-green-600 dark:text-green-400">{changes.description}</span>
                              </div>
                            )}
                            {changes.hours !== undefined && (
                              <div className="text-xs">
                                <span className="text-gray-400">hours: </span>
                                <span className="line-through text-red-500 dark:text-red-400">{task?.hours ?? '—'}</span>
                                <span className="text-gray-400"> → </span>
                                <span className="text-green-600 dark:text-green-400">{changes.hours ?? '—'}</span>
                              </div>
                            )}
                            {changes.cost !== undefined && (
                              <div className="text-xs">
                                <span className="text-gray-400">cost: </span>
                                <span className="line-through text-red-500 dark:text-red-400">{task?.cost ?? '—'}</span>
                                <span className="text-gray-400"> → </span>
                                <span className="text-green-600 dark:text-green-400">{changes.cost ?? '—'}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!hasChanges && (
                <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3 text-sm text-green-700 dark:text-green-300">
                  <CheckCircle2 className="w-4 h-4" />
                  No changes detected — the imported file matches the current data.
                </div>
              )}
            </div>
          )}

          {applyState === 'done' && (
            <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3 text-sm text-green-700 dark:text-green-300">
              <CheckCircle2 className="w-4 h-4" />
              Changes applied successfully!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!hasChanges || applyState !== 'idle'}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {applyState === 'applying' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Applying…</>
            ) : (
              <>Apply {selectedRemovals.size + (diff?.modified.length ?? 0)} change(s)</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
