import { useEffect, useRef, useState } from 'react';
import { Trash2, Loader2, StickyNote } from 'lucide-react';
import { api } from '../services/api';
import { Note } from '../types';

// Deliberately minimal: free text only, no title/tags/client/project. Add,
// edit in place, delete. Optimized to be fast to use from a phone.
export function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const draftRef = useRef<HTMLTextAreaElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      setNotes(await api.getNotes());
    } catch (err) {
      console.error('Error loading notes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    const content = draft.trim();
    if (!content) return;
    setAdding(true);
    try {
      const created = await api.addNote(content);
      setNotes((prev) => [{ id: created.id, content: created.content, createdAt: new Date().toISOString() }, ...prev]);
      setDraft('');
      draftRef.current?.focus();
    } catch (err) {
      console.error('Error adding note:', err);
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (note: Note) => {
    setEditingId(note.id);
    setEditingContent(note.content);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const content = editingContent.trim();
    const id = editingId;
    setEditingId(null);
    if (!content) return;
    try {
      await api.updateNote(id, content);
      setNotes((prev) => prev.map((n) => n.id === id ? { ...n, content } : n));
    } catch (err) {
      console.error('Error updating note:', err);
    }
  };

  const handleDelete = async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    try {
      await api.deleteNote(id);
    } catch (err) {
      console.error('Error deleting note:', err);
      load();
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-4">
        <StickyNote className="w-5 h-5 text-yellow-500" />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Notes</h1>
      </div>

      <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
        <textarea
          ref={draftRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Escribí una idea..."
          rows={3}
          className="w-full resize-none border-0 focus:ring-0 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-base"
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={handleAdd}
            disabled={adding || !draft.trim()}
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors"
          >
            {adding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Agregar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Cargando...
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          Todavía no hay notas. Escribí la primera arriba.
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 flex items-start gap-2"
            >
              {editingId === note.id ? (
                <textarea
                  autoFocus
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  onBlur={saveEdit}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      (e.target as HTMLTextAreaElement).blur();
                    }
                  }}
                  rows={3}
                  className="flex-1 resize-none border-0 focus:ring-0 bg-transparent text-gray-900 dark:text-white text-base"
                />
              ) : (
                <p
                  onClick={() => startEdit(note)}
                  className="flex-1 whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 cursor-text py-1"
                >
                  {note.content}
                </p>
              )}
              <button
                onClick={() => handleDelete(note.id)}
                className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
                title="Eliminar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
