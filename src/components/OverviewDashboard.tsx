import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  subMonths, startOfMonth, endOfMonth, format, isWithinInterval, parseISO
} from 'date-fns';
import {
  TrendingUp, TrendingDown, Clock, DollarSign, Package, AlertTriangle,
  FileText, CheckCircle, BarChart3, Users, Receipt
} from 'lucide-react';

type Range = 3 | 6;

interface MonthStat {
  label: string;
  key: string;
  hours: number;
  serviceRevenue: number;
  suppliesCost: number;
  net: number;
  taskCount: number;
  incidentCount: number;
  requestCount: number;
  suppliesCount: number;
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

export function OverviewDashboard() {
  const { tasks, clients, getClient } = useApp();
  const [range, setRange] = useState<Range>(3);

  // Unbilled: finished service tasks (not insumos) that have billed !== true
  const unbilledByClient = useMemo(() => {
    const map: Record<string, { name: string; hours: number; revenue: number; count: number }> = {};
    tasks
      .filter(t => t.finished && t.type !== 'insumos' && !t.billed)
      .forEach(t => {
        const c = getClient(t.clientId);
        if (!c) return;
        if (!map[t.clientId]) map[t.clientId] = { name: c.name, hours: 0, revenue: 0, count: 0 };
        map[t.clientId].hours += t.hours || 0;
        map[t.clientId].revenue += (t.hours || 0) * (c.hourlyRate || 0);
        map[t.clientId].count++;
      });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [tasks, getClient]);

  const today = new Date();

  // Build per-month stats for the selected range
  const months: MonthStat[] = useMemo(() => {
    return Array.from({ length: range }, (_, i) => {
      const ref = subMonths(today, range - 1 - i);
      const start = startOfMonth(ref);
      const end = endOfMonth(ref);
      const key = format(ref, 'yyyy-MM');
      const label = format(ref, 'MMM yyyy');

      const monthTasks = tasks.filter(t =>
        t.finished && isWithinInterval(parseISO(t.date), { start, end })
      );

      const hours = monthTasks
        .filter(t => t.type !== 'insumos')
        .reduce((s, t) => s + (t.hours || 0), 0);

      const serviceRevenue = monthTasks
        .filter(t => t.type !== 'insumos')
        .reduce((s, t) => {
          const c = getClient(t.clientId);
          return s + (t.hours || 0) * (c?.hourlyRate || 0);
        }, 0);

      const suppliesCost = monthTasks
        .filter(t => t.type === 'insumos')
        .reduce((s, t) => s + (t.cost || 0), 0);

      return {
        label,
        key,
        hours,
        serviceRevenue,
        suppliesCost,
        net: serviceRevenue - suppliesCost,
        taskCount: monthTasks.length,
        incidentCount: monthTasks.filter(t => t.type === 'incident').length,
        requestCount: monthTasks.filter(t => t.type === 'request').length,
        suppliesCount: monthTasks.filter(t => t.type === 'insumos').length,
      };
    });
  }, [tasks, range, getClient]);

  // Totals for the period
  const totals = useMemo(() => ({
    hours: months.reduce((s, m) => s + m.hours, 0),
    serviceRevenue: months.reduce((s, m) => s + m.serviceRevenue, 0),
    suppliesCost: months.reduce((s, m) => s + m.suppliesCost, 0),
    net: months.reduce((s, m) => s + m.net, 0),
    taskCount: months.reduce((s, m) => s + m.taskCount, 0),
  }), [months]);

  // Client breakdown for the whole period
  const clientBreakdown = useMemo(() => {
    const start = startOfMonth(subMonths(today, range - 1));
    const end = endOfMonth(today);
    const periodTasks = tasks.filter(t =>
      t.finished && isWithinInterval(parseISO(t.date), { start, end })
    );

    const map: Record<string, { name: string; hours: number; revenue: number; suppliesCost: number; taskCount: number }> = {};
    periodTasks.forEach(t => {
      const c = getClient(t.clientId);
      if (!c) return;
      if (!map[t.clientId]) {
        map[t.clientId] = { name: c.name, hours: 0, revenue: 0, suppliesCost: 0, taskCount: 0 };
      }
      map[t.clientId].taskCount++;
      if (t.type === 'insumos') {
        map[t.clientId].suppliesCost += t.cost || 0;
      } else {
        map[t.clientId].hours += t.hours || 0;
        map[t.clientId].revenue += (t.hours || 0) * (c.hourlyRate || 0);
      }
    });

    return Object.values(map).sort((a, b) => (b.revenue - b.suppliesCost) - (a.revenue - a.suppliesCost));
  }, [tasks, range, getClient]);

  // Bar chart scale
  const maxNet = Math.max(...months.map(m => m.net), 1);

  const lastMonth = months[months.length - 1];
  const prevMonth = months[months.length - 2] ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Performance Overview</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Read-only summary of completed work</p>
        </div>

        {/* Range toggle */}
        <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1 gap-1">
          {([3, 6] as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                range === r
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {r} Months
            </button>
          ))}
        </div>
      </div>

      {/* Period KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Net Revenue</p>
            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">${totals.net.toFixed(0)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Services ${totals.serviceRevenue.toFixed(0)} — Supplies ${totals.suppliesCost.toFixed(0)}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Hours</p>
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totals.hours.toFixed(1)}h</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Avg {(totals.hours / range).toFixed(1)}h/month
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tasks Completed</p>
            <div className="p-2 bg-teal-100 dark:bg-teal-900/20 rounded-lg">
              <CheckCircle className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totals.taskCount}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Avg {(totals.taskCount / range).toFixed(0)}/month
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Month vs Prev</p>
            <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
              <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            ${lastMonth?.net.toFixed(0) ?? '—'}
          </p>
          <div className="mt-1">
            <TrendBadge value={pct(lastMonth?.net ?? 0, prevMonth?.net ?? 0)} />
            {prevMonth && (
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">vs ${prevMonth.net.toFixed(0)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Bar chart + monthly table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visual bar chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            Net Revenue by Month
          </h2>
          <div className="space-y-3">
            {months.map(m => {
              const barPct = maxNet > 0 ? (m.net / maxNet) * 100 : 0;
              const isLast = m.key === lastMonth?.key;
              return (
                <div key={m.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-20 flex-shrink-0">{m.label}</span>
                    <span className={`text-xs font-semibold ${isLast ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      ${m.net.toFixed(0)}
                    </span>
                  </div>
                  <div className="relative h-6 bg-gray-100 dark:bg-gray-700 rounded-md overflow-hidden">
                    {/* service bar */}
                    <div
                      className={`absolute left-0 top-0 h-full rounded-md transition-all duration-500 ${isLast ? 'bg-blue-500' : 'bg-blue-300 dark:bg-blue-700'}`}
                      style={{ width: `${barPct}%` }}
                    />
                    {/* supplies overlay (red subtraction) */}
                    {m.suppliesCost > 0 && (
                      <div
                        className="absolute right-0 top-0 h-full bg-red-300/60 dark:bg-red-700/40 rounded-r-md"
                        style={{ width: `${Math.min((m.suppliesCost / Math.max(m.serviceRevenue, 1)) * barPct, barPct)}%` }}
                        title={`Supplies: $${m.suppliesCost.toFixed(0)}`}
                      />
                    )}
                    <span className="absolute inset-0 flex items-center pl-2 text-xs text-white font-medium">
                      {m.hours.toFixed(1)}h · {m.taskCount} tasks
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-blue-400 inline-block" /> Net revenue</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-red-300 inline-block" /> Supplies cost</span>
          </div>
        </div>

        {/* Monthly breakdown table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-500" />
            Month-by-Month Breakdown
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="pb-2 pr-3">Month</th>
                  <th className="pb-2 pr-3 text-right">Hours</th>
                  <th className="pb-2 pr-3 text-right">Services</th>
                  <th className="pb-2 pr-3 text-right">Supplies</th>
                  <th className="pb-2 text-right">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {months.map((m, i) => {
                  const prev = i > 0 ? months[i - 1] : null;
                  const netTrend = pct(m.net, prev?.net ?? 0);
                  const isLast = i === months.length - 1;
                  return (
                    <tr key={m.key} className={isLast ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}>
                      <td className="py-2.5 pr-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                        {m.label}
                      </td>
                      <td className="py-2.5 pr-3 text-right text-gray-600 dark:text-gray-400">{m.hours.toFixed(1)}h</td>
                      <td className="py-2.5 pr-3 text-right text-gray-700 dark:text-gray-300">${m.serviceRevenue.toFixed(0)}</td>
                      <td className="py-2.5 pr-3 text-right text-red-500 dark:text-red-400">{m.suppliesCost > 0 ? `-$${m.suppliesCost.toFixed(0)}` : '—'}</td>
                      <td className="py-2.5 text-right">
                        <span className="font-semibold text-gray-900 dark:text-white">${m.net.toFixed(0)}</span>
                        {prev !== null && (
                          <span className="ml-1">
                            <TrendBadge value={netTrend} />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 dark:border-gray-600">
                  <td className="pt-3 pr-3 font-bold text-gray-900 dark:text-white text-xs uppercase">Total</td>
                  <td className="pt-3 pr-3 text-right font-bold text-gray-900 dark:text-white">{totals.hours.toFixed(1)}h</td>
                  <td className="pt-3 pr-3 text-right font-bold text-gray-900 dark:text-white">${totals.serviceRevenue.toFixed(0)}</td>
                  <td className="pt-3 pr-3 text-right font-bold text-red-500 dark:text-red-400">-${totals.suppliesCost.toFixed(0)}</td>
                  <td className="pt-3 text-right font-bold text-green-600 dark:text-green-400 text-base">${totals.net.toFixed(0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Task type breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[
          { label: 'Incidents', icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/20', key: 'incidentCount' as const },
          { label: 'Requests', icon: FileText, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/20', key: 'requestCount' as const },
          { label: 'Supplies', icon: Package, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/20', key: 'suppliesCount' as const },
        ].map(({ label, icon: Icon, color, bg, key }) => {
          const total = months.reduce((s, m) => s + m[key], 0);
          return (
            <div key={key} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`p-2 ${bg} rounded-lg`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <span className="font-medium text-gray-900 dark:text-white">{label}</span>
                </div>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">{total}</span>
              </div>
              <div className="flex gap-1">
                {months.map(m => {
                  const val = m[key];
                  const maxVal = Math.max(...months.map(x => x[key]), 1);
                  const h = Math.round((val / maxVal) * 40);
                  return (
                    <div key={m.key} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex items-end justify-center" style={{ height: 44 }}>
                        <div
                          className={`w-full rounded-t-sm ${bg.replace('bg-', 'bg-').replace('/20', '/60')} transition-all`}
                          style={{ height: h || 2 }}
                          title={`${m.label}: ${val}`}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-none">{format(parseISO(m.key + '-01'), 'MMM')}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unbilled warning */}
      {unbilledByClient.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-200 dark:border-orange-800/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Receipt className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-orange-900 dark:text-orange-200">Unbilled Work</h2>
              <p className="text-xs text-orange-600 dark:text-orange-400">
                {unbilledByClient.reduce((s, c) => s + c.count, 0)} tasks across {unbilledByClient.length} client{unbilledByClient.length !== 1 ? 's' : ''} — mark as billed from the Client Dashboard
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-lg font-bold text-orange-900 dark:text-orange-200">
                ${unbilledByClient.reduce((s, c) => s + c.revenue, 0).toFixed(0)}
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-400">total unbilled</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {unbilledByClient.map(c => (
              <div key={c.name} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg px-3 py-2 border border-orange-100 dark:border-orange-900/30">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{c.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{c.count} task{c.count !== 1 ? 's' : ''} · {c.hours.toFixed(1)}h</p>
                </div>
                <span className="text-sm font-semibold text-orange-700 dark:text-orange-300">${c.revenue.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Client breakdown */}
      {clientBreakdown.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" />
            Client Summary — {range}-Month Period
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="pb-2 pr-4">Client</th>
                  <th className="pb-2 pr-4 text-center">Tasks</th>
                  <th className="pb-2 pr-4 text-right">Hours</th>
                  <th className="pb-2 pr-4 text-right">Services</th>
                  <th className="pb-2 pr-4 text-right">Supplies</th>
                  <th className="pb-2 text-right">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {clientBreakdown.map(c => (
                  <tr key={c.name} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="py-3 pr-4 font-medium text-gray-900 dark:text-white">{c.name}</td>
                    <td className="py-3 pr-4 text-center text-gray-600 dark:text-gray-400">{c.taskCount}</td>
                    <td className="py-3 pr-4 text-right text-gray-600 dark:text-gray-400">{c.hours.toFixed(1)}h</td>
                    <td className="py-3 pr-4 text-right text-gray-700 dark:text-gray-300">${c.revenue.toFixed(0)}</td>
                    <td className="py-3 pr-4 text-right text-red-500 dark:text-red-400">{c.suppliesCost > 0 ? `-$${c.suppliesCost.toFixed(0)}` : '—'}</td>
                    <td className="py-3 text-right font-semibold text-gray-900 dark:text-white">
                      ${(c.revenue - c.suppliesCost).toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
