import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-white rounded-lg shadow-lg p-6 dark:bg-gray-800 ${className}`}>
      {children}
    </div>
  );
}