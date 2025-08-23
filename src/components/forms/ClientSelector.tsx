import React from 'react';
import { Client } from '../../types';

interface ClientSelectorProps {
  clients: Client[];
  value: string;
  onChange: (clientId: string) => void;
}

export function ClientSelector({ clients, value, onChange }: ClientSelectorProps) {
  return (
    <div>
      <label htmlFor="client" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Client
      </label>
      <select
        id="client"
        required
        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select a client</option>
        {clients.map(client => (
          <option key={client.id} value={client.id}>{client.name}</option>
        ))}
      </select>
    </div>
  );
}