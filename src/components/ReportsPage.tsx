import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  format, startOfMonth, endOfMonth, subMonths, addMonths,
  isWithinInterval, parseISO
} from 'date-fns';
import {
  Download, FileText, ChevronLeft, ChevronRight, BarChart3,
  Users, Folders, Globe, CalendarDays, Clock, CheckCircle2, Package, FileCode
} from 'lucide-react';
import { PDFExporter } from '../utils/pdfExport';
import { generateMarkdownReport, downloadMarkdown } from '../utils/markdownExport';
import { apiService } from '../services/api';

type ExportMode = 'monthly' | 'multimonth' | 'project';

export function ReportsPage() {
  const { clients, projects, tasks, getClientTasks, getProject } = useApp();

  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [exportMode, setExportMode] = useState<ExportMode>('monthly');

  // Monthly mode
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // Multi-month mode
  const [startMonth, setStartMonth] = useState(subMonths(new Date(), 2));
  const [endMonth, setEndMonth] = useState(new Date());

  const [isExporting, setIsExporting] = useState(false);

  const activeClients = useMemo(() => clients.filter(c => !c.archived), [clients]);
  const selectedClient = useMemo(() => activeClients.find(c => c.id === selectedClientId), [activeClients, selectedClientId]);
  const clientProjects = useMemo(() =>
    selectedClientId ? projects.filter(p => p.clientId === selectedClientId) : [],
    [projects, selectedClientId]
  );

  const availableYears = useMemo(() => {
    if (!selectedClientId) return [];
    const clientTasks = getClientTasks(selectedClientId).filter(t => t.finished);
    const years = [...new Set(clientTasks.map(t => new Date(t.date).getFullYear()))].sort((a, b) => b - a);
    return years;
  }, [selectedClientId, getClientTasks]);

  const getHourlyRateForYear = (client: any, year: number): number => {
    if (client.yearlyRates?.length > 0) {
      const yr = client.yearlyRates.find((r: any) => r.year === year);
      if (yr) return yr.hourlyRate;
    }
    return client.hourlyRate;
  };

  // Preview stats for the current selection
  const previewStats = useMemo(() => {
    if (!selectedClientId) return null;
    const allTasks = getClientTasks(selectedClientId);

    let filtered: typeof allTasks = [];

    if (exportMode === 'monthly') {
      const s = startOfMonth(selectedMonth);
      const e = endOfMonth(selectedMonth);
      filtered = allTasks.filter(t => t.finished && isWithinInterval(parseISO(t.date + 'T00:00:00'), { start: s, end: e }));
    } else if (exportMode === 'multimonth') {
      const s = startOfMonth(startMonth);
      const e = endOfMonth(endMonth);
      filtered = allTasks.filter(t => t.finished && isWithinInterval(parseISO(t.date + 'T00:00:00'), { start: s, end: e }));
    } else {
      filtered = allTasks.filter(t =>
        t.finished &&
        (selectedProjectId === 'all' || t.projectId === selectedProjectId) &&
        (selectedYear === 'all' || new Date(t.date).getFullYear() === parseInt(selectedYear))
      );
    }

    const serviceTasks = filtered.filter(t => t.type !== 'insumos');
    const supplyTasks = filtered.filter(t => t.type === 'insumos');
    const hours = serviceTasks.reduce((s, t) => s + (t.hours || 0), 0);
    const revenue = serviceTasks.reduce((s, t) => {
      const rate = selectedClient ? getHourlyRateForYear(selectedClient, new Date(t.date).getFullYear()) : 0;
      return s + (t.hours || 0) * rate;
    }, 0);
    const suppliesCost = supplyTasks.reduce((s, t) => s + (t.cost || 0), 0);

    return {
      taskCount: filtered.length,
      serviceCount: serviceTasks.length,
      supplyCount: supplyTasks.length,
      incidentCount: serviceTasks.filter(t => t.type === 'incident').length,
      requestCount: serviceTasks.filter(t => t.type === 'request').length,
      hours,
      revenue,
      suppliesCost,
    };
  }, [selectedClientId, selectedClient, exportMode, selectedMonth, startMonth, endMonth, selectedProjectId, selectedYear, getClientTasks]);

  const handleExport = async () => {
    if (!selectedClient) return;
    setIsExporting(true);
    try {
      const allTasks = getClientTasks(selectedClient.id);
      const companySettings = await apiService.getCompanySettings();

      if (exportMode === 'monthly') {
        const s = startOfMonth(selectedMonth);
        const e = endOfMonth(selectedMonth);
        const exportTasks = allTasks.filter(t =>
          t.finished && isWithinInterval(parseISO(t.date + 'T00:00:00'), { start: s, end: e })
        );
        if (exportTasks.length === 0) { alert('No completed tasks for the selected period.'); return; }

        const pdf = new PDFExporter(companySettings);
        const hourlyRate = getHourlyRateForYear(selectedClient, selectedMonth.getFullYear());
        const reportNumber = `RPT-${format(selectedMonth, 'yyyyMM')}-${selectedClient.id.slice(-6)}`;

        await pdf.addHeader('Monthly Report');
        pdf.addSection('Report Details', {
          'Report Number': reportNumber,
          'Client': selectedClient.name,
          'Period': format(selectedMonth, 'MMMM yyyy'),
          'Generated': format(new Date(), 'MMM dd, yyyy'),
          'Service Rate': `$${hourlyRate.toFixed(2)}/hour`
        });
        pdf.addClientReportSections(exportTasks, getProject, hourlyRate);
        pdf.addNotes('Thank you', 'Thank you for your business!');
        pdf.save(`${selectedClient.name.toLowerCase().replace(/\s+/g, '-')}-monthly-${format(selectedMonth, 'yyyy-MM')}.pdf`);

      } else if (exportMode === 'multimonth') {
        const s = startOfMonth(startMonth);
        const e = endOfMonth(endMonth);
        if (s > e) { alert('Start month must be before or equal to end month.'); return; }
        const exportTasks = allTasks.filter(t =>
          t.finished && isWithinInterval(parseISO(t.date + 'T00:00:00'), { start: s, end: e })
        );
        if (exportTasks.length === 0) { alert('No completed tasks in the selected range.'); return; }

        const pdf = new PDFExporter(companySettings);
        const uniqueYears = [...new Set(exportTasks.map(t => new Date(t.date).getFullYear()))].sort();
        const yearlyRatesUsed = uniqueYears.map(year => ({ year, rate: getHourlyRateForYear(selectedClient, year) }));
        const ratesDisplay = yearlyRatesUsed.length > 1
          ? yearlyRatesUsed.map(yr => `${yr.year}: $${yr.rate.toFixed(2)}/hour`).join(', ')
          : `$${yearlyRatesUsed[0]?.rate.toFixed(2)}/hour`;

        await pdf.addHeader('Multi-Month Report');
        pdf.addSection('Report Details', {
          'Report Number': `RPT-${format(s, 'yyyyMM')}-${format(e, 'yyyyMM')}-${selectedClient.id.slice(-6)}`,
          'Client': selectedClient.name,
          'Period': `${format(s, 'MMM yyyy')} – ${format(e, 'MMM yyyy')}`,
          'Generated': format(new Date(), 'MMM dd, yyyy'),
          'Service Rate(s)': ratesDisplay
        });
        pdf.addClientReportSections(exportTasks, getProject, selectedClient.hourlyRate);
        pdf.addNotes('Thank you', 'Thank you for your business!');
        pdf.save(`${selectedClient.name.toLowerCase().replace(/\s+/g, '-')}-report-${format(s, 'yyyy-MM')}-to-${format(e, 'yyyy-MM')}.pdf`);

      } else {
        // project mode
        let exportTasks = allTasks.filter(t =>
          t.finished &&
          (selectedProjectId === 'all' || t.projectId === selectedProjectId) &&
          (selectedYear === 'all' || new Date(t.date).getFullYear() === parseInt(selectedYear))
        );
        if (exportTasks.length === 0) { alert('No completed tasks found.'); return; }

        const sortedTasks = [...exportTasks].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const projectName = selectedProjectId === 'all' ? 'All Projects' : getProject(selectedProjectId)?.name || 'Project';
        const periodLabel = selectedYear === 'all'
          ? `${format(new Date(sortedTasks[0].date), 'MMM d, yyyy')} – ${format(new Date(sortedTasks[sortedTasks.length - 1].date), 'MMM d, yyyy')}`
          : `${selectedYear}`;
        const rateYear = selectedYear === 'all' ? new Date().getFullYear() : parseInt(selectedYear);
        const hourlyRate = getHourlyRateForYear(selectedClient, rateYear);

        const pdf = new PDFExporter(companySettings);
        await pdf.addHeader('Project Report');
        pdf.addSection('Report Details', {
          'Report Number': `RPT-PROJECT-${selectedClient.id.slice(-6)}${selectedProjectId !== 'all' ? '-' + selectedProjectId.slice(-4) : ''}${selectedYear !== 'all' ? '-' + selectedYear : ''}`,
          'Client': selectedClient.name,
          'Project': projectName,
          'Year': selectedYear === 'all' ? 'All Years' : selectedYear,
          'Period': periodLabel,
          'Total Tasks': exportTasks.length.toString(),
          'Generated': format(new Date(), 'MMM dd, yyyy'),
          'Service Rate': `$${hourlyRate.toFixed(2)}/hour`
        });
        pdf.addClientReportSections(exportTasks, getProject, hourlyRate);
        pdf.addNotes('Thank you', 'Thank you for your business!');
        const projectSlug = selectedProjectId === 'all' ? 'all-projects' : projectName.toLowerCase().replace(/\s+/g, '-');
        const yearSlug = selectedYear === 'all' ? 'all-years' : selectedYear;
        pdf.save(`${selectedClient.name.toLowerCase().replace(/\s+/g, '-')}-${projectSlug}-${yearSlug}.pdf`);
      }
    } catch (err: any) {
      alert(`Failed to generate report: ${err.message || err}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleMarkdownExport = () => {
    if (!selectedClient) return;
    const allTasks = getClientTasks(selectedClient.id);

    let exportTasks: typeof allTasks = [];
    let period = '';
    let filename = '';
    let hourlyRate = selectedClient.hourlyRate;

    if (exportMode === 'monthly') {
      const s = startOfMonth(selectedMonth);
      const e = endOfMonth(selectedMonth);
      exportTasks = allTasks.filter(t => t.finished && isWithinInterval(parseISO(t.date + 'T00:00:00'), { start: s, end: e }));
      period = format(selectedMonth, 'MMMM yyyy');
      hourlyRate = getHourlyRateForYear(selectedClient, selectedMonth.getFullYear());
      filename = `${selectedClient.name.toLowerCase().replace(/\s+/g, '-')}-monthly-${format(selectedMonth, 'yyyy-MM')}.md`;
    } else if (exportMode === 'multimonth') {
      const s = startOfMonth(startMonth);
      const e = endOfMonth(endMonth);
      exportTasks = allTasks.filter(t => t.finished && isWithinInterval(parseISO(t.date + 'T00:00:00'), { start: s, end: e }));
      period = `${format(s, 'MMM yyyy')} – ${format(e, 'MMM yyyy')}`;
      filename = `${selectedClient.name.toLowerCase().replace(/\s+/g, '-')}-report-${format(s, 'yyyy-MM')}-to-${format(e, 'yyyy-MM')}.md`;
    } else {
      exportTasks = allTasks.filter(t =>
        t.finished &&
        (selectedProjectId === 'all' || t.projectId === selectedProjectId) &&
        (selectedYear === 'all' || new Date(t.date).getFullYear() === parseInt(selectedYear))
      );
      const projectName = selectedProjectId === 'all' ? 'All Projects' : getProject(selectedProjectId)?.name || 'Project';
      period = `${projectName}${selectedYear !== 'all' ? ` · ${selectedYear}` : ' · All Years'}`;
      hourlyRate = getHourlyRateForYear(selectedClient, selectedYear !== 'all' ? parseInt(selectedYear) : new Date().getFullYear());
      const projectSlug = selectedProjectId === 'all' ? 'all-projects' : projectName.toLowerCase().replace(/\s+/g, '-');
      filename = `${selectedClient.name.toLowerCase().replace(/\s+/g, '-')}-${projectSlug}-${selectedYear === 'all' ? 'all-years' : selectedYear}.md`;
    }

    if (exportTasks.length === 0) { alert('No completed tasks found for this selection.'); return; }

    const md = generateMarkdownReport(exportTasks, {
      title: `${selectedClient.name} — ${exportMode === 'monthly' ? 'Monthly' : exportMode === 'multimonth' ? 'Multi-Month' : 'Project'} Report`,
      client: selectedClient,
      period,
      generatedAt: new Date(),
      hourlyRate,
    }, getProject);

    downloadMarkdown(md, filename);
  };

  const copyPublicUrl = () => {
    if (!selectedClient?.slug) { alert('Client has no slug.'); return; }
    const d = exportMode === 'monthly' ? selectedMonth : new Date();
    const url = `${window.location.origin}/report/${selectedClient.slug}/${d.getFullYear()}/${d.getMonth() + 1}`;
    navigator.clipboard.writeText(url);
    alert(`URL copied!\n\n${url}`);
  };

  const canExport = !!selectedClient && (previewStats?.taskCount ?? 0) > 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Reports</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Generate and export client reports in one place</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: configuration panel */}
        <div className="lg:col-span-2 space-y-5">

          {/* Step 1: Client */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              1. Select Client
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeClients.map(c => {
                const taskCount = getClientTasks(c.id).filter(t => t.finished).length;
                return (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedClientId(c.id); setSelectedProjectId('all'); setSelectedYear('all'); }}
                    className={`flex items-center justify-between p-3 rounded-lg border-2 text-left transition-all ${
                      selectedClientId === c.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div>
                      <p className={`text-sm font-medium ${selectedClientId === c.id ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`}>
                        {c.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{taskCount} completed tasks</p>
                    </div>
                    {selectedClientId === c.id && (
                      <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
              {activeClients.length === 0 && (
                <p className="text-sm text-gray-400 col-span-2">No active clients.</p>
              )}
            </div>
          </div>

          {/* Step 2: Report type */}
          {selectedClientId && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-teal-500" />
                2. Report Type
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {([
                  { mode: 'monthly' as ExportMode, icon: CalendarDays, label: 'Monthly', desc: 'Single month period' },
                  { mode: 'multimonth' as ExportMode, icon: BarChart3, label: 'Multi-Month', desc: 'Custom date range' },
                  { mode: 'project' as ExportMode, icon: Folders, label: 'By Project', desc: 'Per project, filter by year' },
                ] as const).map(({ mode, icon: Icon, label, desc }) => (
                  <button
                    key={mode}
                    onClick={() => setExportMode(mode)}
                    className={`flex flex-col items-start p-4 rounded-lg border-2 text-left transition-all ${
                      exportMode === mode
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mb-2 ${exportMode === mode ? 'text-teal-600 dark:text-teal-400' : 'text-gray-400'}`} />
                    <p className={`text-sm font-semibold ${exportMode === mode ? 'text-teal-700 dark:text-teal-300' : 'text-gray-900 dark:text-white'}`}>
                      {label}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Period / project configuration */}
          {selectedClientId && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                3. Configure Period
              </h2>

              {exportMode === 'monthly' && (
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setSelectedMonth(m => subMonths(m, 1))}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </button>
                  <div className="flex-1 text-center">
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {format(selectedMonth, 'MMMM yyyy')}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedMonth(m => addMonths(m, 1))}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              )}

              {exportMode === 'multimonth' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Start Month</label>
                    <input
                      type="month"
                      value={format(startMonth, 'yyyy-MM')}
                      onChange={e => setStartMonth(new Date(e.target.value + '-01'))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">End Month</label>
                    <input
                      type="month"
                      value={format(endMonth, 'yyyy-MM')}
                      onChange={e => setEndMonth(new Date(e.target.value + '-01'))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="sm:col-span-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 text-sm text-blue-800 dark:text-blue-300">
                    {format(startMonth, 'MMM yyyy')} – {format(endMonth, 'MMM yyyy')}
                  </div>
                </div>
              )}

              {exportMode === 'project' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Project</label>
                      <select
                        value={selectedProjectId}
                        onChange={e => setSelectedProjectId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="all">All Projects</option>
                        {clientProjects.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Year</label>
                      <select
                        value={selectedYear}
                        onChange={e => setSelectedYear(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="all">All Years</option>
                        {availableYears.map(y => (
                          <option key={y} value={String(y)}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                    {selectedYear === 'all'
                      ? 'Exporting all completed tasks across entire history.'
                      : `Exporting completed tasks for ${selectedYear} only.`}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: preview + actions */}
        <div className="space-y-4">
          {/* Preview stats */}
          <div className={`bg-white dark:bg-gray-800 rounded-xl border p-5 ${
            selectedClient ? 'border-gray-200 dark:border-gray-700' : 'border-dashed border-gray-300 dark:border-gray-600'
          }`}>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">Preview</h2>
            {!selectedClient ? (
              <div className="text-center py-6 text-gray-400 dark:text-gray-500">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Select a client to preview</p>
              </div>
            ) : previewStats && previewStats.taskCount === 0 ? (
              <div className="text-center py-6 text-gray-400 dark:text-gray-500">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No tasks in this period</p>
              </div>
            ) : previewStats ? (
              <div className="space-y-3">
                <div className="text-center pb-3 border-b border-gray-100 dark:border-gray-700">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{previewStats.taskCount}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">total tasks</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
                    <p className="text-sm font-bold text-blue-900 dark:text-blue-300">{previewStats.hours.toFixed(1)}h</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">hours</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
                    <p className="text-sm font-bold text-green-900 dark:text-green-300">${previewStats.revenue.toFixed(0)}</p>
                    <p className="text-xs text-green-600 dark:text-green-400">services</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2">
                    <p className="text-sm font-bold text-red-900 dark:text-red-300">{previewStats.incidentCount}</p>
                    <p className="text-xs text-red-600 dark:text-red-400">incidents</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{previewStats.requestCount}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">requests</p>
                  </div>
                  {previewStats.supplyCount > 0 && (
                    <div className="col-span-2 bg-slate-50 dark:bg-slate-900/20 rounded-lg p-2">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-300">{previewStats.supplyCount} supplies · ${previewStats.suppliesCost.toFixed(0)}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">supplies cost</p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Export</h2>

            <button
              onClick={handleExport}
              disabled={!canExport || isExporting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              {isExporting ? 'Generating PDF...' : 'Download PDF Report'}
            </button>

            <button
              onClick={handleMarkdownExport}
              disabled={!canExport}
              title="Markdown is ideal for AI analysis — includes a duplicate detection section"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors"
            >
              <FileCode className="w-4 h-4 text-teal-500" />
              Download Markdown (AI analysis)
            </button>

            {exportMode === 'monthly' && selectedClient?.slug && (
              <button
                onClick={copyPublicUrl}
                disabled={!selectedClient}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                <Globe className="w-4 h-4" />
                Copy Public Report URL
              </button>
            )}

            {!selectedClient && (
              <p className="text-xs text-center text-gray-400 dark:text-gray-500">Select a client to enable export</p>
            )}
            {selectedClient && (previewStats?.taskCount ?? 0) === 0 && (
              <p className="text-xs text-center text-gray-400 dark:text-gray-500">No tasks found for this selection</p>
            )}
          </div>

          {/* Selected client info */}
          {selectedClient && (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-1">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Client</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedClient.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">${selectedClient.hourlyRate}/hour</p>
              {selectedClient.email && <p className="text-xs text-gray-500 dark:text-gray-400">{selectedClient.email}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
