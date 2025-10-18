import { authDatabase, User } from './database';
import { AUTH_CONFIG } from './authConfig';

export interface LoginResult {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
  remainingAttempts?: number;
  lockedUntil?: string;
}

export interface Session {
  userId: string;
  username: string;
  role: 'admin' | 'user';
  expiresAt: number;
  createdAt: number;
}

class AuthService {
  private sessions: Map<string, Session> = new Map();

  // Generate secure session token
  private generateToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Login user
  async login(username: string, password: string): Promise<LoginResult> {
    try {
      // Input validation
      if (!username || !password) {
        return {
          success: false,
          error: 'Username and password are required'
        };
      }

      // Get user
      const user = authDatabase.getUserByUsername(username);
      if (!user) {
        return {
          success: false,
          error: 'Invalid username or password'
        };
      }

      // Check if user is locked
      if (authDatabase.isUserLocked(user)) {
        return {
          success: false,
          error: 'Account is temporarily locked due to too many failed attempts',
          lockedUntil: user.lockedUntil
        };
      }

      // Verify password
      const isPasswordValid = await authDatabase.verifyPassword(password, user.passwordHash);
      
      if (!isPasswordValid) {
        // Increment login attempts
        const newAttempts = user.loginAttempts + 1;
        let lockedUntil: string | undefined;
        
        if (newAttempts >= AUTH_CONFIG.MAX_LOGIN_ATTEMPTS) {
          lockedUntil = new Date(Date.now() + AUTH_CONFIG.LOCKOUT_DURATION).toISOString();
        }
        
        authDatabase.updateLoginAttempts(username, newAttempts, lockedUntil);
        
        return {
          success: false,
          error: 'Invalid username or password',
          remainingAttempts: Math.max(0, AUTH_CONFIG.MAX_LOGIN_ATTEMPTS - newAttempts),
          lockedUntil
        };
      }

      // Successful login
      authDatabase.updateLastLogin(username);
      
      // Create session
      const token = this.generateToken();
      const session: Session = {
        userId: user.id,
        username: user.username,
        role: user.role,
        expiresAt: Date.now() + AUTH_CONFIG.SESSION_DURATION,
        createdAt: Date.now()
      };
      
      this.sessions.set(token, session);
      
      // Store session in localStorage (encrypted)
      const encryptedSession = btoa(JSON.stringify({
        token,
        userId: user.id,
        username: user.username,
        role: user.role,
        expiresAt: session.expiresAt
      }));
      
      localStorage.setItem('tasktracker_session', encryptedSession);
      
      return {
        success: true,
        user: {
          ...user,
          passwordHash: '' // Don't send password hash to client
        },
        token
      };
      
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'An error occurred during login'
      };
    }
  }

  // Logout user
  logout(token?: string): void {
    if (token) {
      this.sessions.delete(token);
    }
    localStorage.removeItem('tasktracker_session');
  }

  // Validate session
  validateSession(token: string): Session | null {
    let session = this.sessions.get(token);

    // If not in memory, try to restore from localStorage
    if (!session) {
      try {
        const encryptedSession = localStorage.getItem('tasktracker_session');
        if (encryptedSession) {
          const sessionData = JSON.parse(atob(encryptedSession));
          if (sessionData.token === token) {
            // Restore session to memory
            session = {
              userId: sessionData.userId,
              username: sessionData.username,
              role: sessionData.role,
              expiresAt: sessionData.expiresAt,
              createdAt: Date.now()
            };
            this.sessions.set(token, session);
          }
        }
      } catch (error) {
        console.error('Error restoring session:', error);
      }
    }

    if (!session) {
      return null;
    }

    // Check if session has expired
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token);
      localStorage.removeItem('tasktracker_session');
      return null;
    }

    return session;
  }

  // Get current session from localStorage
  getCurrentSession(): Session | null {
    try {
      const encryptedSession = localStorage.getItem('tasktracker_session');
      if (!encryptedSession) {
        return null;
      }
      
      const sessionData = JSON.parse(atob(encryptedSession));
      
      // Validate session
      const session = this.validateSession(sessionData.token);
      if (!session) {
        localStorage.removeItem('tasktracker_session');
        return null;
      }
      
      return session;
    } catch (error) {
      console.error('Session validation error:', error);
      localStorage.removeItem('tasktracker_session');
      return null;
    }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return this.getCurrentSession() !== null;
  }

  // Get current user
  getCurrentUser(): User | null {
    const session = this.getCurrentSession();
    if (!session) {
      return null;
    }
    
    const user = authDatabase.getUserById(session.userId);
    if (user) {
      return {
        ...user,
        passwordHash: '' // Don't expose password hash
      };
    }
    
    return null;
  }

  // Clean expired sessions
  cleanExpiredSessions(): void {
    const now = Date.now();
    for (const [token, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(token);
      }
    }
  }

  // Change password
  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    const user = this.getCurrentUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Validate new password strength
    const validation = authDatabase.validatePasswordStrength(newPassword);
    if (!validation.isValid) {
      return { success: false, error: validation.errors.join(', ') };
    }

    try {
      // Get session token
      const encryptedSession = localStorage.getItem('tasktracker_session');
      if (!encryptedSession) {
        return { success: false, error: 'Not authenticated' };
      }

      const sessionData = JSON.parse(atob(encryptedSession));

      // Call API to change password
      const response = await fetch(`http://localhost:3001/api/users/${user.id}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.token}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to change password' };
      }

      return { success: true };
    } catch (error) {
      console.error('Password change error:', error);
      return { success: false, error: 'An error occurred while changing password' };
    }
  }
}

// Singleton instance
export const authService = new AuthService();

// Clean expired sessions every 5 minutes
setInterval(() => {
  authService.cleanExpiredSessions();
}, 5 * 60 * 1000);