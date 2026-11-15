import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  subMonths, subYears, startOfMonth, endOfMonth, startOfYear, endOfYear,
  format, isWithinInterval, parseISO
} from 'date-fns';
import { TrendingUp, TrendingDown, Clock, ListChecks, Users } from 'lucide-react';

type Granularity = 'month' | 'year';

interface Period {
  key: string;
  label: string;
  start: Date;
  end: Date;
}

interface ClientPeriodStat {
  clientId: string;
  clientName: string;
  periods: { key: string; label: string; hours: number; taskCount: number }[];
  totalHours: number;
  totalTasks: number;
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

export function TrendsDashboard() {
  const { tasks, clients } = useApp();
  const [granularity, setGranularity] = useState<Granularity>('month');
  const [monthRange, setMonthRange] = useState<6 | 12>(6);
  const [yearRange, setYearRange] = useState<3 | 5>(3);
  const [showArchived, setShowArchived] = useState(false);

  const today = new Date();

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

  const clientStats: ClientPeriodStat[] = useMemo(() => {
    const activeClients = clients.filter(c => showArchived || !c.archived);

    return activeClients
      .map(client => {
        const clientTasks = tasks.filter(t => t.clientId === client.id && t.finished);

        const periodStats = periods.map(p => {
          const inPeriod = clientTasks.filter(t => isWithinInterval(parseISO(t.date), { start: p.start, end: p.end }));
          const hours = inPeriod
            .filter(t => t.type !== 'insumos')
            .reduce((s, t) => s + (t.hours || 0), 0);
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
  }, [tasks, clients, periods, showArchived]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Trends</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Hours and tasks per client over time</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Granularity toggle */}
          <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1 gap-1">
            <button
              onClick={() => setGranularity('month')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                granularity === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setGranularity('year')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                granularity === 'year'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Yearly
            </button>
          </div>

          {/* Range toggle */}
          {granularity === 'month' ? (
            <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1 gap-1">
              {([6, 12] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setMonthRange(r)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    monthRange === r
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
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
                    yearRange === r
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {r}yr
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

      {clientStats.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Users className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No completed work in this period</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {clientStats.map(client => {
            const maxHours = Math.max(...client.periods.map(p => p.hours), 1);
            const last = client.periods[client.periods.length - 1];
            const prev = client.periods.length > 1 ? client.periods[client.periods.length - 2] : null;
            const hoursTrend = prev ? pct(last.hours, prev.hours) : null;

            return (
              <div key={client.clientId} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900 dark:text-white">{client.clientName}</h2>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                      <Clock className="w-3.5 h-3.5" />
                      {client.totalHours.toFixed(1)}h
                    </span>
                    <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                      <ListChecks className="w-3.5 h-3.5" />
                      {client.totalTasks}
                    </span>
                    <TrendBadge value={hoursTrend} />
                  </div>
                </div>

                <div className="flex gap-1.5">
                  {client.periods.map(p => {
                    const h = Math.round((p.hours / maxHours) * 56);
                    const isLast = p.key === last.key;
                    return (
                      <div key={p.key} className="flex-1 flex flex-col items-center gap-1" title={`${p.label}: ${p.hours.toFixed(1)}h · ${p.taskCount} tasks`}>
                        <div className="w-full flex items-end justify-center" style={{ height: 60 }}>
                          <div
                            className={`w-full rounded-t-sm transition-all ${isLast ? 'bg-blue-500' : 'bg-blue-300 dark:bg-blue-700'}`}
                            style={{ height: h || 2 }}
                          />
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
      )}
    </div>
  );
}
