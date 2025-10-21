import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Layout } from './components/Layout';
import { WeeklyDashboard } from './components/WeeklyDashboard';
import { ForthnightDashboard } from './components/ForthnightDashboard';
import { MonthlyDashboard } from './components/MonthlyDashboard';
import { ClientDashboard } from './components/ClientDashboard';
import { ProjectsDashboard } from './components/ProjectsDashboard';
import { ClientForm } from './components/ClientForm';
import { TaskForm } from './components/TaskForm';
import { EditTask } from './components/EditTask';
import { PublicMonthlyReport } from './components/PublicMonthlyReport';
import { AboutPage } from './components/AboutPage';
import { AllTasksPage } from './components/AllTasksPage';

export default function App() {
  return (
    <AppProvider>
      <Router>
        <Routes>
          {/* Public routes - no authentication required */}
          <Route path="/report/:clientSlug/:year/:month" element={<PublicMonthlyReport />} />
          <Route path="/about" element={<AboutPage />} />

          {/* Protected routes - authentication required */}
          <Route path="/*" element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<WeeklyDashboard />} />
                  <Route path="/fortnight" element={<ForthnightDashboard />} />
                  <Route path="/monthly" element={<MonthlyDashboard />} />
                  <Route path="/tasks" element={<AllTasksPage />} />
                  <Route path="/clients" element={<ClientDashboard />} />
                  <Route path="/projects" element={<ProjectsDashboard />} />
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