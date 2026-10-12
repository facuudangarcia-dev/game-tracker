import { needsLegalAcceptance } from '../auth/legal';
import type { ProfileVisibility, User } from './user.entity';

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
  /** Country of prices chosen by the user (ISO 3166-1 alpha-2), null when not chosen. */
  country: string | null;
  /** Who sees the profile and activity (decision #84). */
  profileVisibility: ProfileVisibility;
  /** The Terms or the Privacy policy changed since they were accepted (decision #88). */
  legalAcceptanceRequired: boolean;
  createdAt: string;
}

/** Another user as seen by the current one: never the email (decision #84). */
export interface PublicUserDto {
  username: string;
  avatar: AvatarDto;
}

/** Path of another user's uploaded avatar (served to users who aren't blocked). */
export function publicAvatarPath(username: string): string {
  return `/api/users/${encodeURIComponent(username)}/avatar`;
}

type AvatarFields = Pick<User, 'avatarAssetKey' | 'avatarPreset'>;

function avatarDto(user: AvatarFields, path: string): AvatarDto {
  if (user.avatarAssetKey) {
    // The content hash in the key busts browser caches when the image changes.
    const version = user.avatarAssetKey.split('/').pop()?.split('.')[0] ?? '';
    return { kind: 'custom', url: `${path}?v=${version.slice(0, 16)}` };
  }
  return user.avatarPreset ? { kind: 'preset', preset: user.avatarPreset } : null;
}

export function toAvatarDto(user: User): AvatarDto {
  return avatarDto(user, OWN_AVATAR_IMAGE_PATH);
}

export function toPublicUser(user: AvatarFields & Pick<User, 'username'>): PublicUserDto {
  return { username: user.username, avatar: avatarDto(user, publicAvatarPath(user.username)) };
}

export function toUserResponse(user: User): UserResponseDto {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    emailVerified: user.emailVerified,
    avatar: toAvatarDto(user),
    country: user.country,
    profileVisibility: user.profileVisibility,
    legalAcceptanceRequired: needsLegalAcceptance(user),
    createdAt: user.createdAt.toISOString(),
  };
}
