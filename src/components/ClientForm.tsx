import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { User, DollarSign, FolderPlus } from 'lucide-react';
import { generateUniqueSlug } from '../utils/slugify';

export const ClientForm: React.FC = () => {
  const { addClient, addProject, clients } = useApp();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    hourlyRate: '0',
    initialProjectName: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Create the client
    const existingSlugs = clients.map(c => c.slug);
    const slug = generateUniqueSlug(formData.name, existingSlugs);
    
    const clientId = addClient({
      name: formData.name,
      slug,
      email: formData.email,
      hourlyRate: parseFloat(formData.hourlyRate) || 0
    });

    // Create initial project if provided
    if (formData.initialProjectName.trim()) {
      addProject({
        name: formData.initialProjectName,
        clientId,
        status: 'active'
      });
    }

    // Reset form
    setFormData({
      name: '',
      email: '',
      hourlyRate: '0',
      initialProjectName: ''
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center">
        <User className="w-5 h-5 mr-2" />
        Add New Client
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Client Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="Enter client name"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            placeholder="client@example.com"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div>
          <label htmlFor="hourlyRate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Hourly Rate *
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="number"
              id="hourlyRate"
              name="hourlyRate"
              value={formData.hourlyRate}
              onChange={handleChange}
              min="0"
              step="0.01"
              required
              placeholder="0.00"
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label htmlFor="initialProjectName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Initial Project Name
          </label>
          <div className="relative">
            <FolderPlus className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              id="initialProjectName"
              name="initialProjectName"
              value={formData.initialProjectName}
              onChange={handleChange}
              placeholder="Optional: Create first project"
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Leave empty if you want to add projects later
          </p>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          Add Client
        </button>
      </form>
    </div>
  );
};