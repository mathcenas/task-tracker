import React, { createContext, useContext, useEffect, useState } from 'react';
import { Client, Project, Task } from '../types';
import { generateSampleData } from '../utils/sampleData';
import { generateUniqueSlug } from '../utils/slugify';
import { apiService } from '../services/api';

interface AppContextType {
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  addClient: (client: Omit<Client, 'id'>) => Promise<string>;
  addProject: (project: Omit<Project, 'id'>) => Promise<string>;
  addTask: (task: Omit<Task, 'id'>) => Promise<void>;
  isDuplicateTask: (task: Omit<Task, 'id'>) => boolean;
  updateTask: (task: Task) => Promise<void>;
  finishTask: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  deleteClient: (clientId: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  updateClient: (client: Client) => Promise<void>;
  archiveClient: (clientId: string, archived: boolean) => Promise<void>;
  updateProject: (project: Project) => Promise<void>;
  reloadTasks: () => Promise<void>;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  getClientProjects: (clientId: string) => Project[];
  getClientTasks: (clientId: string) => Task[];
  getProjectTasks: (projectId: string) => Task[];
  getClient: (clientId: string) => Client | undefined;
  getProject: (projectId: string) => Project | undefined;
  getTask: (taskId: string) => Task | undefined;
  getClientBySlug: (slug: string) => Client | undefined;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load data from API on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [clientsData, projectsData, tasksData] = await Promise.all([
          apiService.getClients(),
          apiService.getProjects(),
          apiService.getTasks()
        ]);

        setClients(clientsData);
        setProjects(projectsData);
        setTasks(tasksData);
        console.log('✅ Data loaded from API:', { clients: clientsData.length, projects: projectsData.length, tasks: tasksData.length });
      } catch (error) {
        console.error('❌ Error loading data from API:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const addClient = async (client: Omit<Client, 'id'>) => {
    const id = crypto.randomUUID();
    console.log('🆔 [AppContext] Generated client ID:', id);
    const existingSlugs = clients.map(c => c.slug);
    const slug = client.slug || generateUniqueSlug(client.name, existingSlugs);
    const newClient = { ...client, id, slug };
    console.log('📦 [AppContext] New client object:', newClient);

    try {
      console.log('🔄 [AppContext] Calling apiService.createClient...');
      await apiService.createClient(newClient);
      console.log('✅ [AppContext] API call successful, updating state');
      setClients(prev => [...prev, newClient]);
      console.log('✅ [AppContext] Client added successfully:', newClient.name);
      return id;
    } catch (error) {
      console.error('❌ [AppContext] Error adding client:', error);
      console.error('❌ [AppContext] Client data that failed:', newClient);
      throw error;
    }
  };

  const addProject = async (project: Omit<Project, 'id'>) => {
    const id = crypto.randomUUID();
    console.log('🆔 [AppContext] Generated project ID:', id);
    const newProject = { ...project, id };
    console.log('📦 [AppContext] New project object:', newProject);

    try {
      console.log('🔄 [AppContext] Calling apiService.createProject...');
      await apiService.createProject(newProject);
      console.log('✅ [AppContext] API call successful, updating state');
      setProjects(prev => [...prev, newProject]);
      console.log('✅ [AppContext] Project added successfully:', newProject.name);
      return id;
    } catch (error) {
      console.error('❌ [AppContext] Error adding project:', error);
      console.error('❌ [AppContext] Project data that failed:', newProject);
      throw error;
    }
  };

  const isDuplicateTask = (task: Omit<Task, 'id'>) =>
    tasks.some(t =>
      t.clientId === task.clientId &&
      t.date === task.date &&
      t.description.trim().toLowerCase() === task.description.trim().toLowerCase() &&
      (task.hours == null || t.hours === task.hours)
    );

  const addTask = async (task: Omit<Task, 'id'>) => {
    if (isDuplicateTask(task)) {
      throw new Error('DUPLICATE: A task with the same description, date, hours and client already exists.');
    }
    const newTask = { ...task, id: crypto.randomUUID() };
    console.log('📦 [AppContext] New task object:', newTask);

    try {
      console.log('🔄 [AppContext] Calling apiService.createTask...');
      await apiService.createTask(newTask);
      console.log('✅ [AppContext] API call successful, updating state');
      setTasks(prev => [...prev, newTask]);
      console.log('✅ [AppContext] Task added successfully:', {
        id: newTask.id,
        description: newTask.description,
        date: newTask.date,
        finished: newTask.finished,
        clientId: newTask.clientId,
        projectId: newTask.projectId
      });
    } catch (error) {
      console.error('❌ [AppContext] Error adding task:', error);
      console.error('❌ [AppContext] Task data that failed:', newTask);
      throw error;
    }
  };

  const updateTask = async (task: Task) => {
    try {
      await apiService.updateTask(task.id, task);
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
      console.log('🔄 Task updated successfully:', {
        id: task.id,
        description: task.description,
        date: task.date,
        finished: task.finished,
        hours: task.hours,
        cost: task.cost
      });
    } catch (error) {
      console.error('❌ Error updating task:', error);
      throw error;
    }
  };

  const finishTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const updatedTask = { ...task, finished: true, completedAt: new Date().toISOString() };
      try {
        await apiService.updateTask(taskId, updatedTask);
        setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
        console.log('✅ Task finished successfully:', taskId);
      } catch (error) {
        console.error('❌ Error finishing task:', error);
        throw error;
      }
    }
  };

  const getClientProjects = (clientId: string) => {
    return projects.filter(project => project.clientId === clientId);
  };

  const getClientTasks = (clientId: string) => {
    return tasks.filter(task => task.clientId === clientId);
  };

  const getProjectTasks = (projectId: string) => {
    return tasks.filter(task => task.projectId === projectId);
  };

  const getClient = (clientId: string) => {
    return clients.find(client => client.id === clientId);
  };

  const getProject = (projectId: string) => {
    return projects.find(project => project.id === projectId);
  };

  const getTask = (taskId: string) => {
    return tasks.find(task => task.id === taskId);
  };

  const getClientBySlug = (slug: string) => {
    return clients.find(client => client.slug === slug);
  };

  const deleteTask = async (taskId: string) => {
    try {
      await apiService.deleteTask(taskId);
      setTasks(prev => prev.filter(task => task.id !== taskId));
      console.log('✅ Task deleted successfully:', taskId);
    } catch (error) {
      console.error('❌ Error deleting task:', error);
      throw error;
    }
  };

  const deleteClient = async (clientId: string) => {
    try {
      await apiService.deleteClient(clientId);
      // Backend handles cascading deletes, but we update local state too
      setProjects(prev => prev.filter(project => project.clientId !== clientId));
      setTasks(prev => prev.filter(task => task.clientId !== clientId));
      setClients(prev => prev.filter(client => client.id !== clientId));
      console.log('✅ Client deleted successfully:', clientId);
    } catch (error) {
      console.error('❌ Error deleting client:', error);
      throw error;
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      await apiService.deleteProject(projectId);
      // Backend handles cascading deletes, but we update local state too
      setTasks(prev => prev.filter(task => task.projectId !== projectId));
      setProjects(prev => prev.filter(project => project.id !== projectId));
      console.log('✅ Project deleted successfully:', projectId);
    } catch (error) {
      console.error('❌ Error deleting project:', error);
      throw error;
    }
  };

  const archiveClient = async (clientId: string, archived: boolean) => {
    try {
      await apiService.archiveClient(clientId, archived);
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, archived } : c));
    } catch (error) {
      console.error('Error archiving client:', error);
      throw error;
    }
  };

  const updateClient = async (client: Client) => {
    try {
      await apiService.updateClient(client.id, client);
      setClients(prev => prev.map(c => c.id === client.id ? client : c));
      console.log('✅ Client updated successfully:', client.id);
    } catch (error) {
      console.error('❌ Error updating client:', error);
      throw error;
    }
  };

  const updateProject = async (project: Project) => {
    try {
      await apiService.updateProject(project.id, project);
      setProjects(prev => prev.map(p => p.id === project.id ? project : p));
      console.log('✅ Project updated successfully:', project.id);
    } catch (error) {
      console.error('❌ Error updating project:', error);
      throw error;
    }
  };

  const reloadTasks = async () => {
    try {
      const tasksData = await apiService.getTasks();
      setTasks(tasksData);
      console.log('✅ Tasks reloaded from API:', tasksData.length);
    } catch (error) {
      console.error('❌ Error reloading tasks:', error);
      throw error;
    }
  };

  return (
    <AppContext.Provider value={{
      clients,
      projects,
      tasks,
      addClient,
      addProject,
      addTask,
      isDuplicateTask,
      updateTask,
      finishTask,
      setTasks,
      reloadTasks,
      getClientProjects,
      getClientTasks,
      getProjectTasks,
      getClient,
      getProject,
      getTask,
      getClientBySlug,
      deleteTask,
      deleteClient,
      deleteProject,
      updateClient,
      archiveClient,
      updateProject
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};