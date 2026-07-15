import React, { useEffect, useState } from 'react';
import { UserPlus, UserMinus, X, Plus, Trash2, Loader2, Inbox } from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { OnboardingRequest, Client, Project } from '../types';

export function OnboardingAdminPanel() {
  const { reloadTasks } = useApp();
  const [requests, setRequests] = useState<OnboardingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeRequest, setActiveRequest] = useState<OnboardingRequest | null>(null);

  const loadRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getOnboardingRequests();
      setRequests(data);
    } catch (err) {
      console.error('Error loading onboarding requests:', err);
      setError('No se pudieron cargar las solicitudes pendientes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Solicitudes de Altas / Bajas de Personal
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Procesá las solicitudes recibidas asignando cliente, proyecto y accesos configurados.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Cargando solicitudes...
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
          <Inbox className="w-10 h-10 mb-2" />
          No hay solicitudes pendientes.
        </div>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm flex items-center justify-between"
            >
              <div className="flex items-start space-x-3">
                {request.type === 'alta' ? (
                  <UserPlus className="w-5 h-5 text-green-500 mt-0.5" />
                ) : (
                  <UserMinus className="w-5 h-5 text-red-500 mt-0.5" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {request.employeeName}
                    {request.role && <span className="text-gray-400 dark:text-gray-500"> · {request.role}</span>}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Solicitado por {request.managerEmail}
                    {request.effectiveDate && <> · Efectividad: {request.effectiveDate}</>}
                  </p>
                  {request.details && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-xl">{request.details}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setActiveRequest(request)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700
                         dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors shrink-0"
              >
                Procesar
              </button>
            </div>
          ))}
        </div>
      )}

      {activeRequest && (
        <ProcessRequestModal
          request={activeRequest}
          onClose={() => setActiveRequest(null)}
          onConfirmed={() => {
            setActiveRequest(null);
            loadRequests();
            reloadTasks();
          }}
        />
      )}
    </div>
  );
}

interface ProcessRequestModalProps {
  request: OnboardingRequest;
  onClose: () => void;
  onConfirmed: () => void;
}

function ProcessRequestModal({ request, onClose, onConfirmed }: ProcessRequestModalProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [extraServices, setExtraServices] = useState<string[]>([]);
  const [newService, setNewService] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        const [clientsData, projectsData] = await Promise.all([
          api.getClients(),
          api.getProjects()
        ]);
        setClients(clientsData);
        setProjects(projectsData);
      } catch (err) {
        console.error('Error loading clients/projects:', err);
        setError('No se pudieron cargar los clientes y proyectos.');
      } finally {
        setLoadingOptions(false);
      }
    };
    loadOptions();
  }, []);

  const projectsForClient = projects.filter((p) => p.clientId === clientId);

  const handleClientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setClientId(e.target.value);
    setProjectId('');
  };

  const addExtraService = () => {
    const value = newService.trim();
    if (!value) return;
    setExtraServices((prev) => [...prev, value]);
    setNewService('');
  };

  const handleServiceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addExtraService();
    }
  };

  const removeExtraService = (index: number) => {
    setExtraServices((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = async () => {
    setError(null);

    if (!clientId || !projectId) {
      setError('Seleccioná un cliente y un proyecto antes de confirmar.');
      return;
    }

    setSubmitting(true);
    try {
      await api.confirmOnboardingRequest(request.id, {
        clientId,
        projectId,
        extraServices
      });
      onConfirmed();
    } catch (err) {
      console.error('Error confirming onboarding request:', err);
      setError('No se pudo finalizar la solicitud. Intentá nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70" onClick={onClose} />

      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="w-[90vw] max-w-lg rounded-lg bg-white dark:bg-gray-800 p-6 shadow-xl max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Procesar {request.type === 'alta' ? 'Alta' : 'Baja'} - {request.employeeName}
            </h3>
            <button
              onClick={onClose}
              className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 space-y-1">
            <p><span className="font-medium">Solicitante:</span> {request.managerEmail}</p>
            {request.role && <p><span className="font-medium">Puesto:</span> {request.role}</p>}
            {request.effectiveDate && <p><span className="font-medium">Fecha de efectividad:</span> {request.effectiveDate}</p>}
            {request.details && <p><span className="font-medium">Detalles:</span> {request.details}</p>}
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="client" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Cliente
              </label>
              <select
                id="client"
                value={clientId}
                onChange={handleClientChange}
                disabled={loadingOptions}
                className="mt-1 block w-full rounded-lg border-gray-300 bg-white shadow-sm
                         focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600
                         dark:bg-gray-700 dark:text-white transition-all duration-200"
              >
                <option value="">Seleccionar cliente...</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="project" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Proyecto
              </label>
              <select
                id="project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={!clientId}
                className="mt-1 block w-full rounded-lg border-gray-300 bg-white shadow-sm
                         focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600
                         dark:bg-gray-700 dark:text-white transition-all duration-200
                         disabled:opacity-50"
              >
                <option value="">
                  {clientId ? 'Seleccionar proyecto...' : 'Seleccioná un cliente primero'}
                </option>
                {projectsForClient.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="extraService" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Servicios / Accesos Adicionales no solicitados originalmente
              </label>
              <div className="mt-1 flex space-x-2">
                <input
                  type="text"
                  id="extraService"
                  value={newService}
                  onChange={(e) => setNewService(e.target.value)}
                  onKeyDown={handleServiceKeyDown}
                  placeholder="Ej: Cuenta de Slack creada"
                  className="block w-full rounded-lg border-gray-300 bg-white shadow-sm
                           focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600
                           dark:bg-gray-700 dark:text-white transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={addExtraService}
                  className="px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300
                           hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {extraServices.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {extraServices.map((service, index) => (
                    <li
                      key={index}
                      className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-200"
                    >
                      <span>{service}</span>
                      <button
                        type="button"
                        onClick={() => removeExtraService(index)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm
                       font-medium text-gray-700 bg-white hover:bg-gray-50
                       dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300
                       dark:hover:bg-gray-600 transition-all duration-200"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting || loadingOptions}
              className="flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm
                       font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60
                       dark:bg-blue-500 dark:hover:bg-blue-600 transition-all duration-200"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar y Finalizar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
