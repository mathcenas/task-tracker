import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FileText, ArrowLeft, Edit, Download, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { apiService } from '../services/api';
import { PDFExporter } from '../utils/pdfExport';

interface QuoteLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Quote {
  id: string;
  quote_number: string;
  client_id: string;
  client_name: string;
  title: string;
  date: string;
  expiry_date: string | null;
  status: string;
  notes: string;
  terms: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  line_items: QuoteLineItem[];
}

export function QuoteView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuote();
  }, [id]);

  const loadQuote = async () => {
    if (!id) return;

    try {
      const data = await apiService.getQuote(id);
      setQuote(data);
    } catch (error) {
      console.error('Failed to load quote:', error);
      alert('Failed to load quote');
      navigate('/quotes');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!quote) return;

    try {
      const companySettings = await apiService.getCompanySettings();
      const pdf = new PDFExporter(companySettings);

      await pdf.addHeader('QUOTE');

      pdf.addSection('Quote Details', {
        'Quote Number': quote.quote_number,
        'Date': format(new Date(quote.date), 'MMM d, yyyy'),
        ...(quote.expiry_date && { 'Expiry Date': format(new Date(quote.expiry_date), 'MMM d, yyyy') }),
        'Status': quote.status.toUpperCase()
      });

      pdf.addSection('Client Information', {
        'Client': quote.client_name
      });

      pdf.addSection('Description', {
        'Project': quote.title
      });

      const tableData = quote.line_items.map(item => [
        item.description,
        item.quantity.toString(),
        `$${item.unit_price.toFixed(2)}`,
        `$${item.total.toFixed(2)}`
      ]);

      pdf.addTable(
        ['Description', 'Quantity', 'Unit Price', 'Total'],
        tableData
      );

      pdf.addTotals([
        { label: 'Subtotal:', value: `$${quote.subtotal.toFixed(2)}` },
        { label: `Tax (${quote.tax_rate}%):`, value: `$${quote.tax_amount.toFixed(2)}` },
        { label: 'Total:', value: `$${quote.total.toFixed(2)}`, bold: true }
      ]);

      if (quote.notes) {
        pdf.addNotes('Notes', quote.notes);
      }

      if (quote.terms) {
        pdf.addNotes('Terms & Conditions', quote.terms);
      }

      pdf.save(`quote-${quote.quote_number}.pdf`);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      alert('Failed to generate PDF');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      accepted: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      expired: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
    };

    return (
      <span className={`px-3 py-1 text-sm font-medium rounded-lg ${styles[status as keyof typeof styles] || styles.draft}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
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

  if (!quote) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Quote not found</p>
          <Link to="/quotes" className="text-blue-600 hover:underline mt-4 inline-block">
            Back to Quotes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 print:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/quotes')}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                title="Back to Quotes"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-blue-600" />
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Quote {quote.quote_number}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {quote.client_name}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title="Print"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                onClick={handleDownloadPDF}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title="Download PDF"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>
              <button
                onClick={() => navigate(`/quotes/${quote.id}/edit`)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
                Quote Details
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Quote Number:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{quote.quote_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Date:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {format(new Date(quote.date), 'MMM d, yyyy')}
                  </span>
                </div>
                {quote.expiry_date && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Expiry Date:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {format(new Date(quote.expiry_date), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
                Client Information
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Client:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{quote.client_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Status:</span>
                  {getStatusBadge(quote.status)}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {quote.title}
            </h3>
          </div>

          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-4">
              Line Items
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-300 dark:border-gray-600">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Description
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Quantity
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Unit Price
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {quote.line_items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-gray-200 dark:border-gray-700"
                    >
                      <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                        {item.description}
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-gray-600 dark:text-gray-400">
                        {item.quantity}
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-gray-600 dark:text-gray-400">
                        ${item.unit_price.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-sm text-right font-medium text-gray-900 dark:text-white">
                        ${item.total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end mb-8">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Subtotal:</span>
                <span className="font-medium">${quote.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Tax ({quote.tax_rate}%):</span>
                <span className="font-medium">${quote.tax_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white border-t-2 border-gray-300 dark:border-gray-600 pt-2">
                <span>Total:</span>
                <span>${quote.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {quote.notes && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Notes
              </h3>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {quote.notes}
              </p>
            </div>
          )}

          {quote.terms && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Terms & Conditions
              </h3>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {quote.terms}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
