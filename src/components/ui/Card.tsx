import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-white rounded-md border border-gray-200 dark:border-gray-700 p-6 dark:bg-gray-800 ${className}`}>
      {children}
    </div>
  );
}