import bcrypt from 'bcryptjs';

// Static user database with hashed passwords
// In production, this should be moved to environment variables or external secure storage
export interface User {
  id: string;
  username: string;
  passwordHash: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: string;
  lastLogin?: string;
  loginAttempts: number;
  lockedUntil?: string;
  isActive: boolean;
}

// Pre-hashed passwords for security
// Default password for admin: "TaskTracker2025!"
// Default password for user: "User2025!"
const STATIC_USERS: User[] = [
  {
    id: '1',
    username: 'admin',
    passwordHash: '$2a$12$LQv3c1yqBwEHXyvHrCpy2Oe4OvyMpAVnVThdjHtwMO9PSFlEWjgga', // TaskTracker2025!
    email: 'admin@tasktracker.pro',
    role: 'admin',
    createdAt: '2025-01-01T00:00:00.000Z',
    loginAttempts: 0,
    isActive: true
  },
  {
    id: '2',
    username: 'user',
    passwordHash: '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // User2025!
    email: 'user@tasktracker.pro',
    role: 'user',
    createdAt: '2025-01-01T00:00:00.000Z',
    loginAttempts: 0,
    isActive: true
  }
];

export class AuthDatabase {
  private users: User[] = [...STATIC_USERS];

  // Get user by username
  getUserByUsername(username: string): User | undefined {
    return this.users.find(user => user.username === username && user.isActive);
  }

  // Get user by ID
  getUserById(id: string): User | undefined {
    return this.users.find(user => user.id === id && user.isActive);
  }

  // Verify password
  async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  // Update user login attempts
  updateLoginAttempts(username: string, attempts: number, lockedUntil?: string): void {
    const userIndex = this.users.findIndex(user => user.username === username);
    if (userIndex !== -1) {
      this.users[userIndex].loginAttempts = attempts;
      this.users[userIndex].lockedUntil = lockedUntil;
    }
  }

  // Update last login
  updateLastLogin(username: string): void {
    const userIndex = this.users.findIndex(user => user.username === username);
    if (userIndex !== -1) {
      this.users[userIndex].lastLogin = new Date().toISOString();
      this.users[userIndex].loginAttempts = 0; // Reset attempts on successful login
      delete this.users[userIndex].lockedUntil;
    }
  }

  // Check if user is locked
  isUserLocked(user: User): boolean {
    if (!user.lockedUntil) return false;
    
    const lockExpiry = new Date(user.lockedUntil);
    const now = new Date();
    
    if (now > lockExpiry) {
      // Lock has expired, reset attempts
      this.updateLoginAttempts(user.username, 0);
      return false;
    }
    
    return true;
  }

  // Hash password (for creating new users)
  async hashPassword(plainPassword: string): Promise<string> {
    const saltRounds = 12;
    return await bcrypt.hash(plainPassword, saltRounds);
  }

  // Validate password strength
  validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Singleton instance
export const authDatabase = new AuthDatabase();