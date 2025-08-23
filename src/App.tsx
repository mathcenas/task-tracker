import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/Layout';
import { WeeklyDashboard } from './components/WeeklyDashboard';
import { MonthlyDashboard } from './components/MonthlyDashboard';
import { ClientDashboard } from './components/ClientDashboard';
import { ProjectsDashboard } from './components/ProjectsDashboard';
import { ClientForm } from './components/ClientForm';
import { TaskForm } from './components/TaskForm';
import { EditTask } from './components/EditTask';
import { PublicMonthlyReport } from './components/PublicMonthlyReport';

export default function App() {
  return (
    <AppProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<WeeklyDashboard />} />
            <Route path="/monthly" element={<MonthlyDashboard />} />
            <Route path="/clients" element={<ClientDashboard />} />
            <Route path="/projects" element={<ProjectsDashboard />} />
            <Route path="/add-client" element={<ClientForm />} />
            <Route path="/add-task" element={<TaskForm />} />
            <Route path="/task" element={<TaskForm />} />
            <Route path="/edit-task/:taskId" element={<EditTask />} />
            <Route path="/client/:clientId/:year/:month" element={<PublicMonthlyReport />} />
          </Routes>
        </Layout>
      </Router>
    </AppProvider>
  );
}