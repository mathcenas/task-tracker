import React from 'react';

interface TaskTypeSelectorProps {
  value: 'incident' | 'request' | 'insumos';
  onChange: (value: 'incident' | 'request' | 'insumos') => void;
}

export function TaskTypeSelector({ value, onChange }: TaskTypeSelectorProps) {
  return (
    <div>
      <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Task Type
      </label>
      <div className="mt-2 space-x-4">
        <label className="inline-flex items-center">
          <input
            type="radio"
            className="form-radio text-blue-600"
            name="type"
            value="incident"
            checked={value === 'incident'}
            onChange={(e) => onChange(e.target.value as 'incident' | 'request' | 'insumos')}
          />
          <span className="ml-2 dark:text-gray-300">Incident</span>
        </label>
        <label className="inline-flex items-center">
          <input
            type="radio"
            className="form-radio text-blue-600"
            name="type"
            value="request"
            checked={value === 'request'}
            onChange={(e) => onChange(e.target.value as 'incident' | 'request' | 'insumos')}
          />
          <span className="ml-2 dark:text-gray-300">Request</span>
        </label>
        <label className="inline-flex items-center">
          <input
            type="radio"
            className="form-radio text-purple-600"
            name="type"
            value="insumos"
            checked={value === 'insumos'}
            onChange={(e) => onChange(e.target.value as 'incident' | 'request' | 'insumos')}
          />
          <span className="ml-2 dark:text-gray-300">Supplies (Insumos)</span>
        </label>
      </div>
    </div>
  );
}