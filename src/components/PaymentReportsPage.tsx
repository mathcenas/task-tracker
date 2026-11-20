import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Receipt, CheckCircle2, Circle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiService } from '../services/api';
import { getHourlyRateForYear } from '../utils/clientRates';

const BREAKDOWN_TYPES: { type: string; label: string }[] = [
  { type: 'incident', label: 'Incidents' },
  { type: 'request', label: 'Requests' },
  { type: 'problem', label: 'Problems' },
  { type: 'change', label: 'Changes' }
];

interface BillingReport {
  id: string;
  clientId: string;
  clientName: string;
  reportNumber: string | null;
  periodLabel: string | null;
  periodStart: string;
  periodEnd: string;
  taskIds: string[];
  totalAmount: number;
  generatedAt: string;
  paid: boolean;
  paidAt: string | null;
}

export function PaymentReportsPage() {
  const { getTask, getClient } = useApp();
  const [reports, setReports] = useState<BillingReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid'>('unpaid');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiService.getBillingReports();
      setReports(data);
    } catch (error) {
      console.error('Error loading billing reports:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const togglePaid = async (report: BillingReport) => {
    setUpdatingId(report.id);
    try {
      await apiService.setBillingReportPaid(report.id, !report.paid);
      await load();
    } catch (error) {
      console.error('Error updating billing report:', error);
      alert('No se pudo actualizar el reporte. Intentá nuevamente.');
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredReports = reports.filter(r => filter === 'all' || (filter === 'paid' ? r.paid : !r.paid));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Payment Reports</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Reportes generados al exportar un PDF — marcá cuáles ya te pagaron
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      <div className="flex gap-2">
        {([
          { key: 'unpaid', label: 'Pendientes' },
          { key: 'paid', label: 'Pagados' },
          { key: 'all', label: 'Todos' }
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <RefreshCw className="w-8 h-8 text-gray-400 mx-auto mb-3 animate-spin" />
          <p className="text-gray-500 dark:text-gray-400">Cargando reportes...</p>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Receipt className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            {filter === 'unpaid' ? 'No hay reportes pendientes de cobro' : 'No hay reportes'}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Se crean automáticamente cada vez que exportás un PDF de cliente
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          {filteredReports.map(report => {
            const isOpen = expanded === report.id;
            return (
              <div key={report.id}>
                <div className="flex items-center justify-between gap-4 p-4">
                  <button
                    onClick={() => setExpanded(isOpen ? null : report.id)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left"
                  >
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {report.clientName} — {report.periodLabel || `${report.periodStart} a ${report.periodEnd}`}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {report.reportNumber && `${report.reportNumber} · `}
                        {report.taskIds.length} tarea{report.taskIds.length !== 1 ? 's' : ''} · generado {format(new Date(report.generatedAt), 'MMM d, yyyy')}
                        {report.paid && report.paidAt && ` · pagado ${format(new Date(report.paidAt), 'MMM d, yyyy')}`}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="font-semibold text-gray-900 dark:text-white">${report.totalAmount.toFixed(0)}</span>
                    <button
                      onClick={() => togglePaid(report)}
                      disabled={updatingId === report.id}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${
                        report.paid
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/40'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {report.paid ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                      {report.paid ? 'Pagado' : 'Marcar pagado'}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="px-4 pb-4 pl-11">
                    {(() => {
                      const client = getClient(report.clientId);
                      const resolvedTasks = report.taskIds.map(id => getTask(id)).filter((t): t is NonNullable<typeof t> => !!t);
                      const missingCount = report.taskIds.length - resolvedTasks.length;
                      const getRate = (t: { date: string }) => client ? getHourlyRateForYear(client, parseISO(t.date).getFullYear()) : 0;

                      const servicesTasks = resolvedTasks.filter(t => t.type !== 'insumos');
                      const suppliesTasks = resolvedTasks.filter(t => t.type === 'insumos');
                      const breakdownGroups = BREAKDOWN_TYPES
                        .map(({ type, label }) => ({ label, tasks: servicesTasks.filter(t => t.type === type) }))
                        .filter(g => g.tasks.length > 0);
                      const suppliesTotal = suppliesTasks.reduce((s, t) => s + (t.cost || 0), 0);
                      const servicesTotal = servicesTasks.reduce((s, t) => s + (t.hours || 0) * getRate(t), 0);
                      const grandTotal = servicesTotal + suppliesTotal;

                      if (breakdownGroups.length === 0 && suppliesTasks.length === 0) {
                        return <p className="text-sm text-gray-400 dark:text-gray-500 italic">Ninguna de las tareas de este reporte existe ya.</p>;
                      }

                      return (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                                <th className="pb-2 pr-4">Type</th>
                                <th className="pb-2 pr-4 text-center">Tasks</th>
                                <th className="pb-2 pr-4 text-right">Hours</th>
                                <th className="pb-2 pr-4 text-right">Amount</th>
                                <th className="pb-2 text-right">% of Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                              {breakdownGroups.map(({ label, tasks }) => {
                                const h = tasks.reduce((s, t) => s + (t.hours || 0), 0);
                                const amt = tasks.reduce((s, t) => s + (t.hours || 0) * getRate(t), 0);
                                return (
                                  <tr key={label}>
                                    <td className="py-2 pr-4 font-medium text-gray-900 dark:text-white">{label}</td>
                                    <td className="py-2 pr-4 text-center text-gray-600 dark:text-gray-400">{tasks.length}</td>
                                    <td className="py-2 pr-4 text-right text-gray-600 dark:text-gray-400">{h.toFixed(1)}h</td>
                                    <td className="py-2 pr-4 text-right font-semibold text-gray-900 dark:text-white">${amt.toFixed(2)}</td>
                                    <td className="py-2 text-right text-gray-500 dark:text-gray-400">
                                      {grandTotal > 0 ? `${((amt / grandTotal) * 100).toFixed(0)}%` : '0%'}
                                    </td>
                                  </tr>
                                );
                              })}
                              {suppliesTasks.length > 0 && (
                                <tr>
                                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-white">Supplies</td>
                                  <td className="py-2 pr-4 text-center text-gray-600 dark:text-gray-400">{suppliesTasks.length}</td>
                                  <td className="py-2 pr-4 text-right text-gray-400 dark:text-gray-500">—</td>
                                  <td className="py-2 pr-4 text-right font-semibold text-gray-900 dark:text-white">${suppliesTotal.toFixed(2)}</td>
                                  <td className="py-2 text-right text-gray-500 dark:text-gray-400">
                                    {grandTotal > 0 ? `${((suppliesTotal / grandTotal) * 100).toFixed(0)}%` : '0%'}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2 border-gray-200 dark:border-gray-600">
                                <td className="pt-2 pr-4 font-bold text-gray-900 dark:text-white text-xs uppercase">Total</td>
                                <td className="pt-2 pr-4 text-center font-bold text-gray-900 dark:text-white">{resolvedTasks.length}</td>
                                <td className="pt-2 pr-4 text-right font-bold text-gray-900 dark:text-white">
                                  {servicesTasks.reduce((s, t) => s + (t.hours || 0), 0).toFixed(1)}h
                                </td>
                                <td className="pt-2 pr-4 text-right font-bold text-green-600 dark:text-green-400">${grandTotal.toFixed(2)}</td>
                                <td className="pt-2 text-right font-bold text-gray-500 dark:text-gray-400">100%</td>
                              </tr>
                            </tfoot>
                          </table>
                          {missingCount > 0 && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 italic mt-2">
                              {missingCount} tarea{missingCount !== 1 ? 's' : ''} de este reporte ya no existe{missingCount !== 1 ? 'n' : ''} (no incluida{missingCount !== 1 ? 's' : ''} arriba).
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
