export type UserRole = 'admin' | 'manager' | 'accountant' | 'leasing' | 'maintenance' | 'viewer';

export type UserStatus = 'active' | 'suspended' | 'pending';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  permissions: string[];
  createdAt: string;
  lastActive: string;
  passwordHash: string;
}

export interface AuditEntry {
  id: string;
  adminId: string;
  action: string;
  targetUserId?: string;
  details: string;
  timestamp: string;
  ip: string;
}

export interface AuthPayload {
  token: string;
  exp: number;
  userId: string;
  role: UserRole;
}
