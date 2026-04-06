import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Plus, Trash2, ArrowLeft, Download } from 'lucide-react';
import { format } from 'date-fns';
import { apiService } from '../services/api';
import { useApp } from '../context/AppContext';
import { PDFExporter } from '../utils/pdfExport';

interface QuoteItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

interface QuoteFormData {
  client_id: string;
  title: string;
  date: string;
  expiry_date: string;
  notes: string;
  terms: string;
  tax_rate: number;
  status: string;
  quote_type: string;
  items: QuoteItem[];
}

export function QuoteForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { clients } = useApp();
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [companySettings, setCompanySettings] = useState<any>(null);

  const [formData, setFormData] = useState<QuoteFormData>({
    client_id: '',
    title: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    expiry_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    notes: '',
    terms: 'Payment is due within 30 days of the quote date.\nThis quote is valid for 30 days from the date of issue.',
    tax_rate: 0,
    status: 'draft',
    quote_type: 'standard',
    items: [{ description: '', quantity: 1, unit_price: 0, amount: 0 }]
  });

  useEffect(() => {
    loadCompanySettings();
    if (id) {
      loadQuote();
    }
  }, [id]);

  const loadCompanySettings = async () => {
    try {
      const settings = await apiService.getCompanySettings();
      setCompanySettings(settings || {});
    } catch (error) {
      console.error('Failed to load company settings:', error);
      setCompanySettings({});
    }
  };

  const loadQuote = async () => {
    if (!id) return;

    try {
      const quote = await apiService.getQuote(id);

      const items = (quote.line_items || []).map((item: any) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.total || item.amount || 0
      }));

      setFormData({
        client_id: quote.client_id,
        title: quote.title,
        date: quote.date,
        expiry_date: quote.expiry_date || '',
        notes: quote.notes || '',
        terms: quote.terms || '',
        tax_rate: quote.tax_rate || 0,
        status: quote.status || 'draft',
        quote_type: quote.quote_type || 'standard',
        items: items.length > 0 ? items : [{ description: '', quantity: 1, unit_price: 0, amount: 0 }]
      });
    } catch (error) {
      console.error('Failed to load quote:', error);
      alert('Failed to load quote');
    } finally {
      setLoading(false);
    }
  };

  const calculateItemAmount = (quantity: number, unitPrice: number) => {
    return quantity * unitPrice;
  };

  const calculateSubtotal = () => {
    return formData.items.reduce((sum, item) => sum + item.amount, 0);
  };

  const calculateTax = () => {
    return calculateSubtotal() * (formData.tax_rate / 100);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const handleItemChange = (index: number, field: keyof QuoteItem, value: string | number) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'quantity' || field === 'unit_price') {
      const quantity = field === 'quantity' ? Number(value) : newItems[index].quantity;
      const unitPrice = field === 'unit_price' ? Number(value) : newItems[index].unit_price;
      newItems[index].amount = calculateItemAmount(quantity, unitPrice);
    }

    setFormData({ ...formData, items: newItems });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: '', quantity: 1, unit_price: 0, amount: 0 }]
    });
  };

  const removeItem = (index: number) => {
    if (formData.items.length === 1) return;
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const handleSave = async () => {
    if (!formData.client_id || !formData.title || formData.items.length === 0) {
      alert('Please fill in all required fields and add at least one item');
      return;
    }

    setSaving(true);

    try {
      if (id) {
        await apiService.updateQuote(id, formData);
      } else {
        const result = await apiService.createQuote(formData);
        navigate(`/quotes/${result.id}`);
        return;
      }

      alert('Quote saved successfully!');
      navigate('/quotes');
    } catch (error) {
      console.error('Failed to save quote:', error);
      alert('Failed to save quote');
    } finally {
      setSaving(false);
    }
  };

  const exportToPDF = async () => {
    if (!formData.client_id || !formData.title) {
      alert('Please fill in client and title first');
      return;
    }

    const client = clients.find(c => c.id === formData.client_id);
    const isBOM = formData.quote_type === 'bom';

    try {
      const pdf = new PDFExporter(companySettings);

      await pdf.addHeader(isBOM ? 'Bill of Materials (BOM)' : 'Quote');

      const detailsSection: Record<string, string> = {
        'Date': format(new Date(formData.date), 'MMM d, yyyy'),
        'Status': formData.status.toUpperCase()
      };

      if (formData.expiry_date) {
        detailsSection['Valid Until'] = format(new Date(formData.expiry_date), 'MMM d, yyyy');
      }

      pdf.addSection(isBOM ? 'BOM Details' : 'Quote Details', detailsSection);

      pdf.addSection('Client Information', {
        'Client': client?.name || ''
      });

      pdf.addSection('Description', {
        'Project': formData.title
      });

      const tableData = isBOM
        ? formData.items.map(item => [
            item.description,
            Number(item.quantity).toString()
          ])
        : formData.items.map(item => [
            item.description,
            Number(item.quantity).toString(),
            `$${Number(item.unit_price).toFixed(2)}`,
            `$${Number(item.amount).toFixed(2)}`
          ]);

      const tableHeaders = isBOM
        ? ['Description', 'Quantity']
        : ['Description', 'Quantity', 'Unit Price', 'Amount'];

      const columnStyles = isBOM
        ? {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 30, halign: 'center' }
          }
        : {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 25, halign: 'center' },
            2: { cellWidth: 30, halign: 'right' },
            3: { cellWidth: 30, halign: 'right' }
          };

      pdf.addTable(tableHeaders, tableData, { columnStyles });

      if (!isBOM) {
        const subtotal = calculateSubtotal();
        const tax = calculateTax();
        const total = calculateTotal();

        const totalsData = [
          { label: 'Subtotal:', value: `$${subtotal.toFixed(2)}` }
        ];

        if (formData.tax_rate > 0) {
          totalsData.push({ label: `Tax (${formData.tax_rate}%):`, value: `$${tax.toFixed(2)}` });
        }

        totalsData.push({ label: 'Total:', value: `$${total.toFixed(2)}`, bold: true });

        pdf.addTotals(totalsData);
      }

      if (formData.notes) {
        pdf.addNotes('Notes', formData.notes);
      }

      if (formData.terms) {
        pdf.addNotes('Terms & Conditions', formData.terms);
      }

      const fileName = isBOM
        ? `BOM-${format(new Date(formData.date), 'yyyy-MM-dd')}-${client?.name || 'Client'}.pdf`
        : `Quote-${format(new Date(formData.date), 'yyyy-MM-dd')}-${client?.name || 'Client'}.pdf`;

      pdf.save(fileName);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      alert('Failed to generate PDF');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading quote...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/quotes')}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {id ? 'Edit Quote' : 'New Quote'}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Create a professional quote for your client
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Client *
              </label>
              <select
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                required
              >
                <option value="">Select a client</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Quote Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="e.g., Website Development Quote"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Quote Type *
              </label>
              <select
                value={formData.quote_type}
                onChange={(e) => setFormData({ ...formData, quote_type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="standard">Standard (with prices)</option>
                <option value="bom">BOM (Bill of Materials)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Quote Date *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Valid Until
              </label>
              <input
                type="date"
                value={formData.expiry_date}
                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Line Items</h3>
              <button
                onClick={addItem}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>

            <div className="space-y-3">
              {formData.items.map((item, index) => (
                <div key={index} className={`grid gap-3 items-start p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg ${formData.quote_type === 'bom' ? 'grid-cols-8' : 'grid-cols-12'}`}>
                  <div className={formData.quote_type === 'bom' ? 'col-span-6' : 'col-span-5'}>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="Description"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="Qty"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  {formData.quote_type !== 'bom' && (
                    <>
                      <div className="col-span-2">
                        <input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="Price"
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div className="col-span-2">
                        <div className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-white">
                          ${item.amount.toFixed(2)}
                        </div>
                      </div>
                    </>
                  )}
                  <div className="col-span-1 flex justify-end">
                    <button
                      onClick={() => removeItem(index)}
                      disabled={formData.items.length === 1}
                      className="p-2 text-red-600 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {formData.quote_type !== 'bom' && (
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    ${calculateSubtotal().toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Tax Rate:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={formData.tax_rate}
                      onChange={(e) => setFormData({ ...formData, tax_rate: Number(e.target.value) })}
                      className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                    <span className="text-gray-600 dark:text-gray-400">%</span>
                  </div>
                </div>
                {formData.tax_rate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Tax:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      ${calculateTax().toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t border-gray-300 dark:border-gray-600 pt-2">
                  <span className="text-gray-900 dark:text-white">Total:</span>
                  <span className="text-blue-600">${calculateTotal().toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              rows={3}
              placeholder="Additional notes for the client..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Terms & Conditions
            </label>
            <textarea
              value={formData.terms}
              onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              rows={4}
              placeholder="Payment terms, delivery conditions, etc..."
            />
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between">
          <button
            onClick={exportToPDF}
            className="inline-flex items-center gap-2 px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </button>

          <div className="flex gap-3">
            <button
              onClick={() => navigate('/quotes')}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Quote'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
