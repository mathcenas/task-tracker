import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Layout } from './components/Layout';
import { WeeklyDashboard } from './components/WeeklyDashboard';
import { WorkQueue } from './components/WorkQueue';
import { ForthnightDashboard } from './components/ForthnightDashboard';
import { MonthlyDashboard } from './components/MonthlyDashboard';
import { ClientDashboard } from './components/ClientDashboard';
import { ProjectsDashboard } from './components/ProjectsDashboard';
import { ClientForm } from './components/ClientForm';
import { TaskForm } from './components/TaskForm';
import { EditTask } from './components/EditTask';
import { PublicMonthlyReport } from './components/PublicMonthlyReport';
import { PublicStatusPage } from './components/PublicStatusPage';
import { AboutPage } from './components/AboutPage';
import { AllTasksPage } from './components/AllTasksPage';
import { RecurringTasksPage } from './components/RecurringTasksPage';
import { KanbanBoard } from './components/KanbanBoard';
import MonitorIntegration from './components/MonitorIntegration';
import StatusPageSettings from './components/StatusPageSettings';
import { CSVImport } from './components/CSVImport';
import { JSONImport } from './components/JSONImport';
import { ActivityLog } from './components/ActivityLog';
import { CompanySettings } from './components/CompanySettings';
import { QuotesList } from './components/QuotesList';
import { QuoteForm } from './components/QuoteForm';
import { QuoteView } from './components/QuoteView';
import { IdeasBoard } from './components/IdeasBoard';
import { SuppliesPage } from './components/SuppliesPage';
import { SuppliesPaymentTracker } from './components/SuppliesPaymentTracker';
import { OverviewDashboard } from './components/OverviewDashboard';
import { ReportsPage } from './components/ReportsPage';

export default function App() {
  return (
    <AppProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Public routes - no authentication required */}
          <Route path="/report/:clientSlug/:year/:month" element={<PublicMonthlyReport />} />
          <Route path="/status/:slug" element={<PublicStatusPage />} />
          <Route path="/about" element={<AboutPage />} />

          {/* Protected routes - authentication required */}
          <Route path="/*" element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<WorkQueue />} />
                  <Route path="/weekly" element={<WeeklyDashboard />} />
                  <Route path="/fortnight" element={<ForthnightDashboard />} />
                  <Route path="/monthly" element={<MonthlyDashboard />} />
                  <Route path="/overview" element={<OverviewDashboard />} />
                  <Route path="/tasks" element={<AllTasksPage />} />
                  <Route path="/kanban" element={<KanbanBoard />} />
                  <Route path="/ideas" element={<IdeasBoard />} />
                  <Route path="/supplies" element={<SuppliesPage />} />
                  <Route path="/supplies/payments" element={<SuppliesPaymentTracker />} />
                  <Route path="/recurring-tasks" element={<RecurringTasksPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/clients" element={<ClientDashboard />} />
                  <Route path="/projects" element={<ProjectsDashboard />} />
                  <Route path="/import-csv" element={<CSVImport />} />
                  <Route path="/import-json" element={<JSONImport />} />
                  <Route path="/activity-log" element={<ActivityLog />} />
                  <Route path="/integrations/monitors" element={<MonitorIntegration />} />
                  <Route path="/integrations/status-pages" element={<StatusPageSettings />} />
                  <Route path="/settings/company" element={<CompanySettings />} />
                  <Route path="/quotes" element={<QuotesList />} />
                  <Route path="/quotes/new" element={<QuoteForm />} />
                  <Route path="/quotes/:id/edit" element={<QuoteForm />} />
                  <Route path="/quotes/:id" element={<QuoteView />} />
                  <Route path="/add-client" element={<ClientForm />} />
                  <Route path="/add-task" element={<TaskForm />} />
                  <Route path="/task" element={<TaskForm />} />
                  <Route path="/edit-task/:taskId" element={<EditTask />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </AppProvider>
  );
}