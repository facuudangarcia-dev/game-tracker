import type { User } from './user.entity';

/** Public representation of a user. Never includes the password hash. */
export interface UserResponseDto {
  id: string;
  email: string;
  createdAt: string;
}

export function toUserResponse(user: User): UserResponseDto {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}
