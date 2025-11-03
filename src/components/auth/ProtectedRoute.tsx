import React from 'react';
import { api } from '../../services/api';
import { LoginForm } from './LoginForm';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'user';
}

const getSession = () => {
  try {
    const encryptedSession = localStorage.getItem('tasktracker_session');
    if (!encryptedSession) return null;
    const sessionData = JSON.parse(atob(encryptedSession));
    if (Date.now() > sessionData.expiresAt) {
      localStorage.removeItem('tasktracker_session');
      return null;
    }
    return sessionData;
  } catch {
    return null;
  }
};

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasPermission, setHasPermission] = React.useState(false);

  React.useEffect(() => {
    checkAuthentication();
  }, [requiredRole]);

  const checkAuthentication = () => {
    const session = getSession();

    if (session) {
      setIsAuthenticated(true);

      // Check role-based permissions
      if (requiredRole) {
        if (requiredRole === 'admin' && session.role !== 'admin') {
          setHasPermission(false);
        } else {
          setHasPermission(true);
        }
      } else {
        setHasPermission(true);
      }
    } else {
      setIsAuthenticated(false);
      setHasPermission(false);
    }

    setIsLoading(false);
  };

  const handleLoginSuccess = () => {
    checkAuthentication();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  if (!hasPermission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You don't have permission to access this resource.
          </p>
          <button
            onClick={() => {
              api.logout();
              window.location.reload();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}