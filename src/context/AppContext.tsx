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
  updateTask: (task: Task) => Promise<void>;
  finishTask: (taskId: string) => Promise<void>;
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
    const existingSlugs = clients.map(c => c.slug);
    const slug = client.slug || generateUniqueSlug(client.name, existingSlugs);
    const newClient = { ...client, id, slug };

    try {
      await apiService.createClient(newClient);
      setClients(prev => [...prev, newClient]);
      console.log('✅ Client added successfully:', newClient.name);
      return id;
    } catch (error) {
      console.error('❌ Error adding client:', error);
      throw error;
    }
  };

  const addProject = async (project: Omit<Project, 'id'>) => {
    const id = crypto.randomUUID();
    const newProject = { ...project, id };

    try {
      await apiService.createProject(newProject);
      setProjects(prev => [...prev, newProject]);
      console.log('✅ Project added successfully:', newProject.name);
      return id;
    } catch (error) {
      console.error('❌ Error adding project:', error);
      throw error;
    }
  };

  const addTask = async (task: Omit<Task, 'id'>) => {
    const newTask = { ...task, id: crypto.randomUUID() };

    try {
      await apiService.createTask(newTask);
      setTasks(prev => [...prev, newTask]);
      console.log('✅ Task added successfully:', {
        id: newTask.id,
        description: newTask.description,
        date: newTask.date,
        finished: newTask.finished,
        clientId: newTask.clientId,
        projectId: newTask.projectId
      });
    } catch (error) {
      console.error('❌ Error adding task:', error);
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

  const deleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
  };

  const deleteClient = (clientId: string) => {
    // Also delete associated projects and tasks
    setProjects(prev => prev.filter(project => project.clientId !== clientId));
    setTasks(prev => prev.filter(task => task.clientId !== clientId));
    setClients(prev => prev.filter(client => client.id !== clientId));
  };

  const deleteProject = (projectId: string) => {
    // Also delete associated tasks
    setTasks(prev => prev.filter(task => task.projectId !== projectId));
    setProjects(prev => prev.filter(project => project.id !== projectId));
  };

  const updateClient = (client: Client) => {
    setClients(prev => prev.map(c => c.id === client.id ? client : c));
  };

  const updateProject = (project: Project) => {
    setProjects(prev => prev.map(p => p.id === project.id ? project : p));
  };

  return (
    <AppContext.Provider value={{
      clients,
      projects,
      tasks,
      addClient,
      addProject,
      addTask,
      updateTask,
      finishTask,
      setTasks,
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