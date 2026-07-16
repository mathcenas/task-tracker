import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, UserMinus, X, Plus, Trash2, Loader2, Inbox, Send, ExternalLink, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { OnboardingRequest, Client, Project } from '../types';

export function OnboardingAdminPanel() {
  const { reloadTasks } = useApp();
  const [requests, setRequests] = useState<OnboardingRequest[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeRequest, setActiveRequest] = useState<OnboardingRequest | null>(null);
  const [resendState, setResendState] = useState<Record<number, 'sending' | 'sent' | 'error'>>({});

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [requestsData, clientsData, projectsData] = await Promise.all([
        api.getOnboardingRequests(),
        api.getClients(),
        api.getProjects()
      ]);
      setRequests(requestsData);
      setClients(clientsData);
      setProjects(projectsData);
    } catch (err) {
      console.error('Error loading onboarding requests:', err);
      setError('No se pudieron cargar las solicitudes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const getClientName = (clientId?: string) => clients.find((c) => c.id === clientId)?.name;
  const getProjectName = (projectId?: string) => projects.find((p) => p.id === projectId)?.name;

  const handleResend = async (request: OnboardingRequest) => {
    setResendState((prev) => ({ ...prev, [request.id]: 'sending' }));
    try {
      await api.resendOnboardingConfirmation(request.id);
      setResendState((prev) => ({ ...prev, [request.id]: 'sent' }));
    } catch (err) {
      console.error('Error resending onboarding confirmation:', err);
      setResendState((prev) => ({ ...prev, [request.id]: 'error' }));
    }
  };

  const pending = requests.filter((r) => r.status === 'pending');
  const completed = requests.filter((r) => r.status === 'completed');

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Solicitudes de Altas / Bajas de Personal
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Procesá las solicitudes recibidas y consultá el histórico de lo ya procesado.
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
          Todavía no hay solicitudes.
        </div>
      ) : (
        <div className="space-y-8">
          {pending.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                Pendientes ({pending.length})
              </h2>
              <div className="grid gap-4">
                {pending.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    clientName={getClientName(request.clientId)}
                    projectName={getProjectName(request.projectId)}
                    resendState={resendState[request.id]}
                    onProcess={() => setActiveRequest(request)}
                    onResend={() => handleResend(request)}
                  />
                ))}
              </div>
            </div>
          )}

          {completed.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                Histórico ({completed.length})
              </h2>
              <div className="grid gap-4">
                {completed.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    clientName={getClientName(request.clientId)}
                    projectName={getProjectName(request.projectId)}
                    resendState={resendState[request.id]}
                    onProcess={() => setActiveRequest(request)}
                    onResend={() => handleResend(request)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeRequest && (
        <ProcessRequestModal
          request={activeRequest}
          clients={clients}
          projects={projects}
          onClose={() => setActiveRequest(null)}
          onConfirmed={() => {
            setActiveRequest(null);
            loadAll();
            reloadTasks();
          }}
        />
      )}
    </div>
  );
}

interface RequestCardProps {
  request: OnboardingRequest;
  clientName?: string;
  projectName?: string;
  resendState?: 'sending' | 'sent' | 'error';
  onProcess: () => void;
  onResend: () => void;
}

function RequestCard({ request, clientName, projectName, resendState, onProcess, onResend }: RequestCardProps) {
  const isCompleted = request.status === 'completed';

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm flex items-center justify-between gap-4">
      <div className="flex items-start space-x-3 min-w-0">
        {request.type === 'alta' ? (
          <UserPlus className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
        ) : (
          <UserMinus className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
            {request.employeeName}
            {request.role && <span className="text-gray-400 dark:text-gray-500 font-normal"> · {request.role}</span>}
            {isCompleted ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                Procesada
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                Pendiente
              </span>
            )}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Solicitado por {request.managerEmail}
            {request.effectiveDate && <> · Efectividad: {request.effectiveDate}</>}
            {request.createdAt && <> · {new Date(request.createdAt).toLocaleDateString('es-UY')}</>}
          </p>
          {isCompleted && (clientName || projectName) && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {clientName || '—'} {projectName && <>· {projectName}</>}
            </p>
          )}
          {request.details && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-xl">{request.details}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isCompleted ? (
          <>
            {request.taskId && (
              <Link
                to={`/edit-task/${request.taskId}`}
                className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300
                         border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Ver tarea
              </Link>
            )}
            <button
              onClick={onResend}
              disabled={resendState === 'sending'}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700
                       disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
            >
              {resendState === 'sending' ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : resendState === 'sent' ? (
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              ) : (
                <Send className="w-3.5 h-3.5 mr-1.5" />
              )}
              {resendState === 'sent' ? 'Enviado' : resendState === 'error' ? 'Reintentar' : 'Reenviar'}
            </button>
          </>
        ) : (
          <button
            onClick={onProcess}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700
                     dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
          >
            Procesar
          </button>
        )}
      </div>
    </div>
  );
}

interface TagListInputProps {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
  inputType?: string;
}

function TagListInput({ label, placeholder, values, onChange, inputType = 'text' }: TagListInputProps) {
  const [draft, setDraft] = useState('');

  const addValue = () => {
    const value = draft.trim();
    if (!value) return;
    onChange([...values, value]);
    setDraft('');
  };

  const removeValue = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <div className="mt-1 flex space-x-2">
        <input
          type={inputType}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addValue();
            }
          }}
          onBlur={addValue}
          placeholder={placeholder}
          className="block w-full rounded-lg border-gray-300 bg-white shadow-sm
                   focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600
                   dark:bg-gray-700 dark:text-white transition-all duration-200"
        />
        <button
          type="button"
          onClick={addValue}
          className="px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300
                   hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {values.length > 0 && (
        <ul className="mt-2 space-y-1">
          {values.map((value, index) => (
            <li
              key={index}
              className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-200"
            >
              <span>{value}</span>
              <button
                type="button"
                onClick={() => removeValue(index)}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface ProcessRequestModalProps {
  request: OnboardingRequest;
  clients: Client[];
  projects: Project[];
  onClose: () => void;
  onConfirmed: () => void;
}

function ProcessRequestModal({ request, clients, projects, onClose, onConfirmed }: ProcessRequestModalProps) {
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [extraServices, setExtraServices] = useState<string[]>([]);
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectsForClient = projects.filter((p) => p.clientId === clientId);

  const handleClientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setClientId(e.target.value);
    setProjectId('');
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
        extraServices,
        cc: ccEmails
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

            <TagListInput
              label="Servicios / Accesos Adicionales no solicitados originalmente"
              placeholder="Ej: Cuenta de Slack creada"
              values={extraServices}
              onChange={setExtraServices}
            />

            <TagListInput
              label="Copiar (CC) a otros mails del cliente"
              placeholder="otro.gerente@cliente.com"
              inputType="email"
              values={ccEmails}
              onChange={setCcEmails}
            />
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
              disabled={submitting}
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
