import type { User } from './user.entity';

/** Path of the current user's uploaded avatar (private: served only to its owner). */
export const OWN_AVATAR_IMAGE_PATH = '/api/profile/avatar/image';

export type AvatarDto = { kind: 'preset'; preset: string } | { kind: 'custom'; url: string } | null;

/** Public representation of a user. Never includes the password hash nor verification data. */
export interface UserResponseDto {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  avatar: AvatarDto;
  createdAt: string;
}

export function toAvatarDto(user: User): AvatarDto {
  if (user.avatarAssetKey) {
    // The content hash in the key busts browser caches when the image changes.
    const version = user.avatarAssetKey.split('/').pop()?.split('.')[0] ?? '';
    return { kind: 'custom', url: `${OWN_AVATAR_IMAGE_PATH}?v=${version.slice(0, 16)}` };
  }
  return user.avatarPreset ? { kind: 'preset', preset: user.avatarPreset } : null;
}

export function toUserResponse(user: User): UserResponseDto {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    emailVerified: user.emailVerified,
    avatar: toAvatarDto(user),
    createdAt: user.createdAt.toISOString(),
  };
}
