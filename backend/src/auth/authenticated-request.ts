import type { Request } from 'express';
import type { User } from '../users/user.entity';

export interface AuthContext {
  user: User;
  sessionId: string;
}

export interface AuthenticatedRequest extends Request {
  auth: AuthContext;
}
