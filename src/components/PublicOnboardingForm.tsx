import React, { useState } from 'react';
import { UserPlus, UserMinus, CheckCircle, Loader2 } from 'lucide-react';
import { api } from '../services/api';

type RequestType = 'alta' | 'baja';

interface FormState {
  managerEmail: string;
  type: RequestType;
  employeeName: string;
  role: string;
  effectiveDate: string;
  details: string;
}

const initialState: FormState = {
  managerEmail: '',
  type: 'alta',
  employeeName: '',
  role: '',
  effectiveDate: '',
  details: ''
};

export function PublicOnboardingForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.managerEmail || !form.employeeName) {
      setError('Completá al menos el email del solicitante y el nombre del empleado.');
      return;
    }

    setSubmitting(true);
    try {
      await api.submitOnboardingRequest({
        managerEmail: form.managerEmail,
        type: form.type,
        employeeName: form.employeeName,
        role: form.role || undefined,
        effectiveDate: form.effectiveDate || undefined,
        details: form.details || undefined
      });
      setSubmitted(true);
      setForm(initialState);
    } catch (err) {
      console.error('Error submitting onboarding request:', err);
      setError('No pudimos enviar la solicitud. Por favor intentá nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 shadow-xl p-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Solicitud enviada
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
            Recibimos tu solicitud. Te enviaremos un correo a la casilla indicada cuando el proceso quede finalizado.
          </p>
          <button
            onClick={() => setSubmitted(false)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700
                     dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
          >
            Enviar otra solicitud
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-lg bg-white dark:bg-gray-800 shadow-xl p-8">
        <div className="flex items-center mb-6">
          {form.type === 'alta' ? (
            <UserPlus className="w-6 h-6 text-green-500 mr-2" />
          ) : (
            <UserMinus className="w-6 h-6 text-red-500 mr-2" />
          )}
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Solicitud de Alta / Baja de Personal
          </h1>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="managerEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email del Solicitante
            </label>
            <input
              type="email"
              id="managerEmail"
              required
              value={form.managerEmail}
              onChange={handleChange('managerEmail')}
              placeholder="gerente@empresa.com"
              className="mt-1 block w-full rounded-lg border-gray-300 bg-white shadow-sm
                       focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600
                       dark:bg-gray-700 dark:text-white transition-all duration-200"
            />
          </div>

          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Tipo de Solicitud
            </label>
            <select
              id="type"
              value={form.type}
              onChange={handleChange('type')}
              className="mt-1 block w-full rounded-lg border-gray-300 bg-white shadow-sm
                       focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600
                       dark:bg-gray-700 dark:text-white transition-all duration-200"
            >
              <option value="alta">Alta</option>
              <option value="baja">Baja</option>
            </select>
          </div>

          <div>
            <label htmlFor="employeeName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Nombre del Empleado
            </label>
            <input
              type="text"
              id="employeeName"
              required
              value={form.employeeName}
              onChange={handleChange('employeeName')}
              placeholder="Nombre y apellido"
              className="mt-1 block w-full rounded-lg border-gray-300 bg-white shadow-sm
                       focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600
                       dark:bg-gray-700 dark:text-white transition-all duration-200"
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Puesto
            </label>
            <input
              type="text"
              id="role"
              value={form.role}
              onChange={handleChange('role')}
              placeholder="Ej: Analista Contable"
              className="mt-1 block w-full rounded-lg border-gray-300 bg-white shadow-sm
                       focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600
                       dark:bg-gray-700 dark:text-white transition-all duration-200"
            />
          </div>

          <div>
            <label htmlFor="effectiveDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Fecha de Efectividad
            </label>
            <input
              type="date"
              id="effectiveDate"
              value={form.effectiveDate}
              onChange={handleChange('effectiveDate')}
              className="mt-1 block w-full rounded-lg border-gray-300 bg-white shadow-sm
                       focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600
                       dark:bg-gray-700 dark:text-white transition-all duration-200"
            />
          </div>

          <div>
            <label htmlFor="details" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Detalles Adicionales
            </label>
            <textarea
              id="details"
              rows={4}
              value={form.details}
              onChange={handleChange('details')}
              placeholder="Accesos requeridos, sistemas, notas para el equipo..."
              className="mt-1 block w-full rounded-lg border-gray-300 bg-white shadow-sm
                       focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600
                       dark:bg-gray-700 dark:text-white transition-all duration-200"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center px-4 py-2 rounded-lg shadow-sm text-sm
                     font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60
                     dark:bg-blue-500 dark:hover:bg-blue-600 transition-all duration-200"
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {submitting ? 'Enviando...' : 'Enviar Solicitud'}
          </button>
        </form>
      </div>
    </div>
  );
}
