import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'users' })
// Emails and usernames are normalized to lowercase by the app; the DB enforces it
// so the unique indexes are effectively case-insensitive.
@Check('CHK_users_email_lowercase', `"email" = lower("email")`)
@Check('CHK_users_username_format', `"username" ~ '^[a-z0-9_]{3,30}$'`)
// At most one avatar: a built-in preset or an uploaded image.
@Check('CHK_users_single_avatar', `"avatar_preset" IS NULL OR "avatar_asset_key" IS NULL`)
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('UQ_users_email', { unique: true })
  @Column({ type: 'varchar', length: 254 })
  email: string;

  @Index('UQ_users_username', { unique: true })
  @Column({ type: 'varchar', length: 30 })
  username: string;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash: string;

  /** Unverified users can't log in nor use any authenticated endpoint. */
  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified: boolean;

  /** HMAC of the pending verification code (never the code itself); null when none. */
  @Column({ name: 'email_verification_code_hash', type: 'char', length: 64, nullable: true })
  emailVerificationCodeHash: string | null;

  @Column({ name: 'email_verification_code_expires_at', type: 'timestamptz', nullable: true })
  emailVerificationCodeExpiresAt: Date | null;

  /** Wrong attempts against the pending code. */
  @Column({ name: 'email_verification_attempts', type: 'smallint', default: 0 })
  emailVerificationAttempts: number;

  /** When the last code was sent (resend cooldown). */
  @Column({ name: 'email_verification_sent_at', type: 'timestamptz', nullable: true })
  emailVerificationSentAt: Date | null;

  @Column({ name: 'terms_accepted_at', type: 'timestamptz' })
  termsAcceptedAt: Date;

  @Column({ name: 'terms_version', type: 'varchar', length: 20 })
  termsVersion: string;

  @Column({ name: 'privacy_accepted_at', type: 'timestamptz' })
  privacyAcceptedAt: Date;

  @Column({ name: 'privacy_version', type: 'varchar', length: 20 })
  privacyVersion: string;

  /** Built-in avatar id (see profile/avatar-presets.ts). */
  @Column({ name: 'avatar_preset', type: 'varchar', length: 40, nullable: true })
  avatarPreset: string | null;

  /** Uploaded avatar in the asset storage ("avatars/<sha256>.<ext>"); private. */
  @Column({ name: 'avatar_asset_key', type: 'varchar', length: 200, nullable: true })
  avatarAssetKey: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
