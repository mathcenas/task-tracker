import React, { createContext, useContext, useEffect, useState } from 'react';
import { Client, Project, Task } from '../types';
import { generateSampleData } from '../utils/sampleData';
import { generateUniqueSlug } from '../utils/slugify';

interface AppContextType {
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  addClient: (client: Omit<Client, 'id'>) => string;
  addProject: (project: Omit<Project, 'id'>) => string;
  addTask: (task: Omit<Task, 'id'>) => void;
  updateTask: (task: Task) => void;
  finishTask: (taskId: string) => void;
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
  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem('clients');
    return saved ? JSON.parse(saved) : [];
  });

  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('projects');
    return saved ? JSON.parse(saved) : [];
  });

  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('tasks');
    return saved ? JSON.parse(saved) : [];
  });

  // Initialize sample data if no data exists
  useEffect(() => {
    // Fix any existing clients that might have undefined slugs
    setClients(prevClients => {
      const needsSlugFix = prevClients.some(client => !client.slug);
      if (needsSlugFix) {
        console.log('Fixing client slugs...');
        const existingSlugs: string[] = [];
        const fixedClients = prevClients.map(client => {
          if (!client.slug) {
            const newSlug = generateUniqueSlug(client.name, existingSlugs);
            console.log(`Generated slug for "${client.name}": ${newSlug}`);
            existingSlugs.push(newSlug);
            return { ...client, slug: newSlug };
          }
          existingSlugs.push(client.slug);
          return client;
        });
        console.log('Fixed clients:', fixedClients.map(c => ({ name: c.name, slug: c.slug })));
        return fixedClients;
      }
      return prevClients;
    });

    if (clients.length === 0 && projects.length === 0 && tasks.length === 0) {
      const sampleData = generateSampleData();
      
      // Add clients first
      const newClients = sampleData.clients.map(client => ({
        ...client,
        id: crypto.randomUUID(),
        slug: generateUniqueSlug(client.name, [])
      }));
      setClients(newClients);
      
      // Add projects with client references
      const newProjects = sampleData.projects.map(project => {
        const clientId = newClients.find(c => c.name === project.clientName)?.id || '';
        return {
          ...project,
          id: crypto.randomUUID(),
          clientId
        };
      });
      setProjects(newProjects);
      
      // Add tasks with client and project references
      const newTasks = sampleData.tasks.map(task => {
        const clientId = newClients.find(c => c.name === task.clientName)?.id || '';
        const projectId = newProjects.find(p => p.name === task.projectName)?.id || '';
        return {
          ...task,
          id: crypto.randomUUID(),
          clientId,
          projectId
        };
      });
      setTasks(newTasks);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('clients', JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem('projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('tasks', JSON.stringify(tasks));
  }, [tasks]);

  const addClient = (client: Omit<Client, 'id'>) => {
    const id = crypto.randomUUID();
    const existingSlugs = clients.map(c => c.slug);
    const slug = client.slug || generateUniqueSlug(client.name, existingSlugs);
    const newClient = { ...client, id, slug };
    setClients(prev => [...prev, newClient]);
    return id;
  };

  const addProject = (project: Omit<Project, 'id'>) => {
    const id = crypto.randomUUID();
    const newProject = { ...project, id };
    setProjects(prev => [...prev, newProject]);
    return id;
  };

  const addTask = (task: Omit<Task, 'id'>) => {
    const newTask = { ...task, id: crypto.randomUUID() };
    setTasks(prev => [...prev, newTask]);
  };

  const updateTask = (task: Task) => {
    setTasks(prev => prev.map(t => t.id === task.id ? task : t));
  };

  const finishTask = (taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, finished: true } : t));
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
      getClientBySlug
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