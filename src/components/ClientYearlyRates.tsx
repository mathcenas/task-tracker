import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, Trash2, Calendar } from 'lucide-react';
import { apiService } from '../services/api';
import { ClientYearlyRate } from '../types';

interface ClientYearlyRatesProps {
  clientId: string;
  clientName: string;
  defaultHourlyRate: number;
  onClose: () => void;
}

export function ClientYearlyRates({ clientId, clientName, defaultHourlyRate, onClose }: ClientYearlyRatesProps) {
  const [yearlyRates, setYearlyRates] = useState<ClientYearlyRate[]>([]);
  const [newYear, setNewYear] = useState(new Date().getFullYear().toString());
  const [newRate, setNewRate] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadYearlyRates();
  }, [clientId]);

  const loadYearlyRates = async () => {
    try {
      const rates = await apiService.getClientYearlyRates(clientId);
      setYearlyRates(rates);
    } catch (error) {
      console.error('Failed to load yearly rates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRate = async () => {
    const year = parseInt(newYear);
    const rate = parseFloat(newRate);

    if (isNaN(year) || year < 2000 || year > 2100) {
      alert('Please enter a valid year between 2000 and 2100');
      return;
    }

    if (isNaN(rate) || rate < 0) {
      alert('Please enter a valid hourly rate');
      return;
    }

    try {
      const newRateData = {
        id: `rate-${clientId}-${year}`,
        year,
        hourlyRate: rate
      };

      await apiService.saveClientYearlyRate(clientId, newRateData);
      await loadYearlyRates();
      setNewYear((year + 1).toString());
      setNewRate('');
    } catch (error) {
      console.error('Failed to save yearly rate:', error);
      alert('Failed to save yearly rate');
    }
  };

  const handleDeleteRate = async (rateId: string, year: number) => {
    if (window.confirm(`Are you sure you want to delete the ${year} rate?`)) {
      try {
        await apiService.deleteClientYearlyRate(clientId, rateId);
        await loadYearlyRates();
      } catch (error) {
        console.error('Failed to delete yearly rate:', error);
        alert('Failed to delete yearly rate');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
              <Calendar className="w-6 h-6 mr-2 text-blue-500" />
              Yearly Rates - {clientName}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Current Default Rate:</strong> ${defaultHourlyRate.toFixed(2)}/hour
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              Set specific rates for different years. When exporting tasks, the system will use the rate for the year the task was performed.
            </p>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add New Yearly Rate</h3>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Year
                </label>
                <select
                  value={newYear}
                  onChange={(e) => setNewYear(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  {Array.from({ length: 7 }, (_, i) => 2024 + i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Hourly Rate
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    value={newRate}
                    onChange={(e) => setNewRate(e.target.value)}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleAddRate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Existing Rates</h3>
            {loading ? (
              <p className="text-gray-500 dark:text-gray-400">Loading...</p>
            ) : yearlyRates.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No yearly rates configured yet. The default rate will be used for all years.</p>
            ) : (
              <div className="space-y-2">
                {yearlyRates.map((rate) => (
                  <div
                    key={rate.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center">
                      <Calendar className="w-5 h-5 text-blue-500 mr-3" />
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{rate.year}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          ${rate.hourlyRate.toFixed(2)}/hour
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteRate(rate.id, rate.year)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                      title="Delete rate"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
