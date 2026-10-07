import type { User } from './user.entity';

/** Public representation of a user. Never includes the password hash nor verification data. */
export interface UserResponseDto {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
}

export function toUserResponse(user: User): UserResponseDto {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt.toISOString(),
  };
}
