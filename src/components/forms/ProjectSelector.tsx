import React from 'react';
import { Project } from '../../types';

interface ProjectSelectorProps {
  projects: Project[];
  value: string;
  onChange: (projectId: string) => void;
}

export function ProjectSelector({ projects, value, onChange }: ProjectSelectorProps) {
  return (
    <div>
      <label htmlFor="project" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Project
      </label>
      <select
        id="project"
        required
        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select a project</option>
        {projects.map(project => (
          <option key={project.id} value={project.id}>{project.name}</option>
        ))}
        <option value="new">+ Add New Project</option>
      </select>
    </div>
  );
}