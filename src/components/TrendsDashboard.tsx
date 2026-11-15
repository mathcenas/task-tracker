import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  subMonths, subYears, startOfMonth, endOfMonth, startOfYear, endOfYear,
  format, isWithinInterval, parseISO, differenceInCalendarDays
} from 'date-fns';
import {
  TrendingUp, TrendingDown, Clock, ListChecks, Users, AlertTriangle,
  FileText, Package, Receipt
} from 'lucide-react';
import { getHourlyRateForYear } from '../utils/clientRates';

type Tab = 'hours' | 'incidents' | 'supplies' | 'unbilled';
type Granularity = 'month' | 'year';

interface Period {
  key: string;
  label: string;
  start: Date;
  end: Date;
}

function pct(a: number, b: number) {
  if (b === 0) return null;
  return ((a - b) / b) * 100;
}

function TrendBadge({ value }: { value: number | null }) {
  if (value === null) return null;
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {Math.abs(value).toFixed(0)}%
    </span>
  );
}

const TABS: { key: Tab; label: string; icon: typeof Clock }[] = [
  { key: 'hours', label: 'Hours', icon: Clock },
  { key: 'incidents', label: 'Incidents vs Requests', icon: AlertTriangle },
  { key: 'supplies', label: 'Supplies vs Labor', icon: Package },
  { key: 'unbilled', label: 'Unbilled', icon: Receipt },
];

export function TrendsDashboard() {
  const { tasks, clients, getClient } = useApp();
  const [tab, setTab] = useState<Tab>('hours');
  const [granularity, setGranularity] = useState<Granularity>('month');
  const [monthRange, setMonthRange] = useState<6 | 12>(6);
  const [yearRange, setYearRange] = useState<3 | 5>(3);
  const [showArchived, setShowArchived] = useState(false);
  const [unbilledFilter, setUnbilledFilter] = useState<'all' | 'services' | 'supplies'>('all');

  const today = new Date();
  const showsPeriods = tab !== 'unbilled';

  const periods: Period[] = useMemo(() => {
    if (granularity === 'month') {
      return Array.from({ length: monthRange }, (_, i) => {
        const ref = subMonths(today, monthRange - 1 - i);
        return {
          key: format(ref, 'yyyy-MM'),
          label: format(ref, 'MMM yyyy'),
          start: startOfMonth(ref),
          end: endOfMonth(ref)
        };
      });
    }
    return Array.from({ length: yearRange }, (_, i) => {
      const ref = subYears(today, yearRange - 1 - i);
      return {
        key: format(ref, 'yyyy'),
        label: format(ref, 'yyyy'),
        start: startOfYear(ref),
        end: endOfYear(ref)
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [granularity, monthRange, yearRange]);

  const activeClients = useMemo(() => clients.filter(c => showArchived || !c.archived), [clients, showArchived]);

  // --- Tab: Hours ---
  const hoursStats = useMemo(() => {
    return activeClients
      .map(client => {
        const clientTasks = tasks.filter(t => t.clientId === client.id && t.finished);
        const periodStats = periods.map(p => {
          const inPeriod = clientTasks.filter(t => isWithinInterval(parseISO(t.date), { start: p.start, end: p.end }));
          const hours = inPeriod.filter(t => t.type !== 'insumos').reduce((s, t) => s + (t.hours || 0), 0);
          return { key: p.key, label: p.label, hours, taskCount: inPeriod.length };
        });
        return {
          clientId: client.id,
          clientName: client.name,
          periods: periodStats,
          totalHours: periodStats.reduce((s, p) => s + p.hours, 0),
          totalTasks: periodStats.reduce((s, p) => s + p.taskCount, 0)
        };
      })
      .filter(c => c.totalTasks > 0)
      .sort((a, b) => b.totalHours - a.totalHours);
  }, [tasks, activeClients, periods]);

  // --- Tab: Incidents vs Requests ---
  const incidentStats = useMemo(() => {
    return activeClients
      .map(client => {
        const clientTasks = tasks.filter(t => t.clientId === client.id && t.finished && (t.type === 'incident' || t.type === 'request'));
        const periodStats = periods.map(p => {
          const inPeriod = clientTasks.filter(t => isWithinInterval(parseISO(t.date), { start: p.start, end: p.end }));
          return {
            key: p.key,
            label: p.label,
            incidents: inPeriod.filter(t => t.type === 'incident').length,
            requests: inPeriod.filter(t => t.type === 'request').length
          };
        });
        const totalIncidents = periodStats.reduce((s, p) => s + p.incidents, 0);
        const totalRequests = periodStats.reduce((s, p) => s + p.requests, 0);
        return { clientId: client.id, clientName: client.name, periods: periodStats, totalIncidents, totalRequests };
      })
      .filter(c => c.totalIncidents + c.totalRequests > 0)
      .sort((a, b) => (b.totalIncidents + b.totalRequests) - (a.totalIncidents + a.totalRequests));
  }, [tasks, activeClients, periods]);

  // --- Tab: Supplies vs Labor ---
  const suppliesStats = useMemo(() => {
    return activeClients
      .map(client => {
        const clientTasks = tasks.filter(t => t.clientId === client.id && t.finished);
        const periodStats = periods.map(p => {
          const inPeriod = clientTasks.filter(t => isWithinInterval(parseISO(t.date), { start: p.start, end: p.end }));
          const laborRevenue = inPeriod
            .filter(t => t.type !== 'insumos')
            .reduce((s, t) => s + (t.hours || 0) * getHourlyRateForYear(client, parseISO(t.date).getFullYear()), 0);
          const suppliesCost = inPeriod.filter(t => t.type === 'insumos').reduce((s, t) => s + (t.cost || 0), 0);
          return { key: p.key, label: p.label, laborRevenue, suppliesCost };
        });
        const totalLabor = periodStats.reduce((s, p) => s + p.laborRevenue, 0);
        const totalSupplies = periodStats.reduce((s, p) => s + p.suppliesCost, 0);
        return { clientId: client.id, clientName: client.name, periods: periodStats, totalLabor, totalSupplies };
      })
      .filter(c => c.totalLabor + c.totalSupplies > 0)
      .sort((a, b) => (b.totalLabor + b.totalSupplies) - (a.totalLabor + a.totalSupplies));
  }, [tasks, activeClients, periods]);

  // --- Tab: Unbilled (point-in-time, not period-based) ---
  const unbilledItems = useMemo(() => {
    return tasks
      .filter(t => {
        if (!t.finished || t.billed) return false;
        const c = getClient(t.clientId);
        if (!c || (c.archived && !showArchived)) return false;
        if (unbilledFilter === 'services') return t.type !== 'insumos';
        if (unbilledFilter === 'supplies') return t.type === 'insumos';
        return true;
      })
      .map(t => {
        const c = getClient(t.clientId);
        const referenceDate = t.completedAt ? parseISO(t.completedAt) : parseISO(t.date);
        return {
          task: t,
          clientName: c?.name || 'Unknown',
          daysOld: Math.max(0, differenceInCalendarDays(today, referenceDate)),
          amount: t.type === 'insumos' ? (t.cost || 0) : (t.hours || 0) * (c ? getHourlyRateForYear(c, parseISO(t.date).getFullYear()) : 0)
        };
      })
      .sort((a, b) => b.daysOld - a.daysOld);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, getClient, showArchived, unbilledFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Trends</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Patterns and warning signs per client over time</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-px">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {showsPeriods ? (
            <>
              <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1 gap-1">
                <button
                  onClick={() => setGranularity('month')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    granularity === 'month' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setGranularity('year')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    granularity === 'year' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  Yearly
                </button>
              </div>

              {granularity === 'month' ? (
                <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1 gap-1">
                  {([6, 12] as const).map(r => (
                    <button
                      key={r}
                      onClick={() => setMonthRange(r)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        monthRange === r ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {r}mo
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1 gap-1">
                  {([3, 5] as const).map(r => (
                    <button
                      key={r}
                      onClick={() => setYearRange(r)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        yearRange === r ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {r}yr
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1 gap-1">
              {([
                { key: 'all', label: 'All' },
                { key: 'services', label: 'Services' },
                { key: 'supplies', label: 'Supplies' }
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setUnbilledFilter(key)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    unbilledFilter === key ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 ml-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            Include archived
          </label>
        </div>
      </div>

      {/* --- Hours tab --- */}
      {tab === 'hours' && (
        hoursStats.length === 0 ? <EmptyState text="No completed work in this period" /> : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {hoursStats.map(client => {
              const maxHours = Math.max(...client.periods.map(p => p.hours), 1);
              const last = client.periods[client.periods.length - 1];
              const prev = client.periods.length > 1 ? client.periods[client.periods.length - 2] : null;
              const trend = prev ? pct(last.hours, prev.hours) : null;
              return (
                <div key={client.clientId} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-gray-900 dark:text-white">{client.clientName}</h2>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400"><Clock className="w-3.5 h-3.5" />{client.totalHours.toFixed(1)}h</span>
                      <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400"><ListChecks className="w-3.5 h-3.5" />{client.totalTasks}</span>
                      <TrendBadge value={trend} />
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {client.periods.map(p => {
                      const h = Math.round((p.hours / maxHours) * 56);
                      const isLast = p.key === last.key;
                      return (
                        <div key={p.key} className="flex-1 flex flex-col items-center gap-1" title={`${p.label}: ${p.hours.toFixed(1)}h · ${p.taskCount} tasks`}>
                          <div className="w-full flex items-end justify-center" style={{ height: 60 }}>
                            <div className={`w-full rounded-t-sm transition-all ${isLast ? 'bg-blue-500' : 'bg-blue-300 dark:bg-blue-700'}`} style={{ height: h || 2 }} />
                          </div>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-none">
                            {granularity === 'month' ? format(parseISO(p.key + '-01'), 'MMM') : p.key}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* --- Incidents vs Requests tab --- */}
      {tab === 'incidents' && (
        incidentStats.length === 0 ? <EmptyState text="No incidents or requests in this period" /> : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {incidentStats.map(client => {
              const total = client.totalIncidents + client.totalRequests;
              const incidentPct = total > 0 ? (client.totalIncidents / total) * 100 : 0;
              const maxCount = Math.max(...client.periods.map(p => p.incidents + p.requests), 1);
              return (
                <div key={client.clientId} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-gray-900 dark:text-white">{client.clientName}</h2>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="flex items-center gap-1 text-red-600 dark:text-red-400"><AlertTriangle className="w-3.5 h-3.5" />{client.totalIncidents}</span>
                      <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400"><FileText className="w-3.5 h-3.5" />{client.totalRequests}</span>
                      <span className={`text-xs font-medium ${incidentPct > 50 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        {incidentPct.toFixed(0)}% incidents
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {client.periods.map(p => {
                      const total = p.incidents + p.requests;
                      const h = Math.round((total / maxCount) * 56);
                      const incidentShare = total > 0 ? p.incidents / total : 0;
                      return (
                        <div key={p.key} className="flex-1 flex flex-col items-center gap-1" title={`${p.label}: ${p.incidents} incidents, ${p.requests} requests`}>
                          <div className="w-full flex flex-col-reverse items-center justify-end overflow-hidden rounded-t-sm" style={{ height: 60 }}>
                            <div style={{ height: Math.round((h || 2) * (1 - incidentShare)) }} className="w-full bg-cyan-300 dark:bg-cyan-700" />
                            <div style={{ height: Math.round((h || 2) * incidentShare) }} className="w-full bg-red-400 dark:bg-red-600" />
                          </div>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-none">
                            {granularity === 'month' ? format(parseISO(p.key + '-01'), 'MMM') : p.key}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-red-400 inline-block" /> Incidents</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-cyan-300 inline-block" /> Requests</span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* --- Supplies vs Labor tab --- */}
      {tab === 'supplies' && (
        suppliesStats.length === 0 ? <EmptyState text="No billable work in this period" /> : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {suppliesStats.map(client => {
              const total = client.totalLabor + client.totalSupplies;
              const suppliesPct = total > 0 ? (client.totalSupplies / total) * 100 : 0;
              const maxAmount = Math.max(...client.periods.map(p => p.laborRevenue + p.suppliesCost), 1);
              return (
                <div key={client.clientId} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-gray-900 dark:text-white">{client.clientName}</h2>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400">${client.totalLabor.toFixed(0)} labor</span>
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">${client.totalSupplies.toFixed(0)} supplies</span>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{suppliesPct.toFixed(0)}% supplies</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {client.periods.map(p => {
                      const total = p.laborRevenue + p.suppliesCost;
                      const h = Math.round((total / maxAmount) * 56);
                      const suppliesShare = total > 0 ? p.suppliesCost / total : 0;
                      return (
                        <div key={p.key} className="flex-1 flex flex-col items-center gap-1" title={`${p.label}: $${p.laborRevenue.toFixed(0)} labor, $${p.suppliesCost.toFixed(0)} supplies`}>
                          <div className="w-full flex flex-col-reverse items-center justify-end overflow-hidden rounded-t-sm" style={{ height: 60 }}>
                            <div style={{ height: Math.round((h || 2) * (1 - suppliesShare)) }} className="w-full bg-green-300 dark:bg-green-700" />
                            <div style={{ height: Math.round((h || 2) * suppliesShare) }} className="w-full bg-amber-400 dark:bg-amber-600" />
                          </div>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-none">
                            {granularity === 'month' ? format(parseISO(p.key + '-01'), 'MMM') : p.key}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-green-300 inline-block" /> Labor</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-amber-400 inline-block" /> Supplies</span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* --- Unbilled tab --- */}
      {tab === 'unbilled' && (
        unbilledItems.length === 0 ? <EmptyState text="Nothing unbilled — all caught up" /> : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {unbilledItems.length} unbilled item{unbilledItems.length !== 1 ? 's' : ''}, oldest first
              </p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                ${unbilledItems.reduce((s, i) => s + i.amount, 0).toFixed(0)} total
              </p>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {unbilledItems.map(({ task, clientName, daysOld, amount }) => (
                <div key={task.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0 flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg flex-shrink-0 ${task.type === 'insumos' ? 'bg-amber-100 dark:bg-amber-900/20' : 'bg-blue-100 dark:bg-blue-900/20'}`}>
                      {task.type === 'insumos' ? <Package className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> : <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{task.description}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{clientName} · {task.type === 'insumos' ? 'Supplies' : `${(task.hours || 0).toFixed(1)}h`}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      daysOld > 60 ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                      : daysOld > 30 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {daysOld}d old
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white w-16 text-right">${amount.toFixed(0)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
      <Users className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
      <p className="text-gray-500 dark:text-gray-400">{text}</p>
    </div>
  );
}
