import React, { useState, useEffect } from 'react';
import { Globe, Plus, ExternalLink, Trash2, CheckCircle, AlertCircle, Copy } from 'lucide-react';
import { apiService } from '../services/api';

interface StatusPage {
  id: string;
  slug: string;
  organization_name: string;
  description: string;
  enabled: boolean;
  created_at: string;
}

export default function StatusPageSettings() {
  const [pages, setPages] = useState<StatusPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPage, setEditingPage] = useState<StatusPage | null>(null);
  const [formData, setFormData] = useState({
    slug: '',
    organization_name: '',
    description: '',
    enabled: true
  });

  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = async () => {
    try {
      const data = await apiService.getStatusPages();
      setPages(data || []);
      console.log('Loaded status pages:', data);
    } catch (error) {
      console.error('Failed to load status pages:', error);
      setPages([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (editingPage) {
        await apiService.updateStatusPage(editingPage.id, {
          slug: formData.slug,
          organizationName: formData.organization_name,
          description: formData.description,
          enabled: formData.enabled
        });
        setMessage({ type: 'success', text: 'Status page updated successfully!' });
      } else {
        await apiService.createStatusPage({
          slug: formData.slug,
          organizationName: formData.organization_name,
          description: formData.description,
          enabled: formData.enabled
        });
        setMessage({ type: 'success', text: 'Status page created successfully!' });
      }

      setFormData({ slug: '', organization_name: '', description: '', enabled: true });
      setShowForm(false);
      setEditingPage(null);
      await loadPages();
    } catch (error: any) {
      console.error('Error saving status page:', error);
      let errorMessage = 'Failed to save status page';

      // Handle specific error messages
      if (error.message?.includes('UNIQUE constraint') || error.message?.includes('duplicate')) {
        errorMessage = 'A status page with this slug already exists. Please choose a different slug.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (page: StatusPage) => {
    setEditingPage(page);
    setFormData({
      slug: page.slug,
      organization_name: page.organization_name,
      description: page.description || '',
      enabled: page.enabled
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this status page?')) return;

    try {
      await apiService.deleteStatusPage(id);
      setMessage({ type: 'success', text: 'Status page deleted successfully!' });
      await loadPages();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to delete status page' });
    }
  };

  const copyUrl = (slug: string) => {
    const url = `${window.location.origin}/status/${slug}`;
    navigator.clipboard.writeText(url);
    setMessage({ type: 'success', text: 'URL copied to clipboard!' });
    setTimeout(() => setMessage(null), 3000);
  };

  const getStatusUrl = (slug: string) => {
    return `${window.location.origin}/status/${slug}`;
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="w-8 h-8 text-blue-600" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Public Status Pages
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Create public status pages powered by Uptime Kuma monitoring
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowForm(!showForm);
                setEditingPage(null);
                setFormData({ slug: '', organization_name: '', description: '', enabled: true });
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              New Status Page
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

        {showForm && (
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  URL Slug
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                  placeholder="my-status-page"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Public URL: {getStatusUrl(formData.slug || 'your-slug')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={formData.organization_name}
                  onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                  placeholder="My Company"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Real-time status of our services"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="enabled" className="text-sm text-gray-900 dark:text-white">
                  Enable this status page
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
                >
                  {loading ? 'Saving...' : editingPage ? 'Update Status Page' : 'Create Status Page'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingPage(null);
                    setFormData({ slug: '', organization_name: '', description: '', enabled: true });
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="p-6">
          {pages.length === 0 ? (
            <div className="text-center py-12">
              <Globe className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No Status Pages Yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Create your first public status page to share your service uptime with customers.
              </p>
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg max-w-md mx-auto">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Note:</strong> Make sure Uptime Kuma is connected first (Integrations &gt; Uptime Kuma) to display monitors on your status page.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {pages.map((page) => (
                <div
                  key={page.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {page.organization_name}
                        </h3>
                        {page.enabled ? (
                          <span className="px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded-full text-xs font-medium">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 rounded-full text-xs font-medium">
                            Disabled
                          </span>
                        )}
                      </div>
                      {page.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          {page.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <code className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 rounded">
                          {getStatusUrl(page.slug)}
                        </code>
                        <button
                          onClick={() => copyUrl(page.slug)}
                          className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                          title="Copy URL"
                        >
                          <Copy className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        </button>
                        <a
                          href={getStatusUrl(page.slug)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                          title="Open in new tab"
                        >
                          <ExternalLink className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        </a>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleEdit(page)}
                        className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(page.id)}
                        className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
