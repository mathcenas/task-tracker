import React from 'react';
import { Clock, AlertCircle, Eye, CheckCircle } from 'lucide-react';

interface TaskStatusBadgeProps {
  status: 'not_started' | 'in_progress' | 'review' | 'completed';
  size?: 'sm' | 'md' | 'lg';
}

export function TaskStatusBadge({ status, size = 'md' }: TaskStatusBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  const config = {
    not_started: {
      label: 'Not Started',
      icon: <Clock className={iconSizes[size]} />,
      classes: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    },
    in_progress: {
      label: 'In Progress',
      icon: <AlertCircle className={iconSizes[size]} />,
      classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
    },
    review: {
      label: 'Review',
      icon: <Eye className={iconSizes[size]} />,
      classes: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
    },
    completed: {
      label: 'Completed',
      icon: <CheckCircle className={iconSizes[size]} />,
      classes: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
    }
  };

  const statusConfig = config[status];

  return (
    <span className={`inline-flex items-center space-x-1 font-medium rounded-full ${sizeClasses[size]} ${statusConfig.classes}`}>
      {statusConfig.icon}
      <span>{statusConfig.label}</span>
    </span>
  );
}
