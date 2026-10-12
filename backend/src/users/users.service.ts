import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, Repository } from 'typeorm';
import { violatedUniqueConstraint } from '../database/postgres-errors';
import { User } from './user.entity';

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('Email already registered');
    this.name = 'EmailAlreadyRegisteredError';
  }
}

export class UsernameTakenError extends Error {
  constructor() {
    super('Username already taken');
    this.name = 'UsernameTakenError';
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Usernames keep their case (decision #76); only surrounding spaces are removed. */
export function normalizeUsername(username: string): string {
  return username.trim();
}

export interface NewUser {
  email: string;
  username: string;
  /** Country of prices and deals (decision #75). */
  country: string;
  passwordHash: string;
  termsVersion: string;
  privacyVersion: string;
  /** Moment the legal documents were accepted. */
  acceptedAt: Date;
}

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  findById(id: string): Promise<User | null> {
    return this.users.findOneBy({ id });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOneBy({ email: normalizeEmail(email) });
  }

  /** Usernames are unique ignoring case: any case finds the account. */
  findByUsername(username: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .where('lower(user.username) = lower(:username)', { username: normalizeUsername(username) })
      .getOne();
  }

  /**
   * Creates an unverified user. The unique indexes are the source of truth for
   * duplicates (no race window).
   */
  async create(input: NewUser, manager: EntityManager = this.users.manager): Promise<User> {
    const repository = manager.getRepository(User);
    try {
      return await repository.save(
        repository.create({
          email: normalizeEmail(input.email),
          username: normalizeUsername(input.username),
          country: input.country,
          passwordHash: input.passwordHash,
          emailVerified: false,
          termsAcceptedAt: input.acceptedAt,
          termsVersion: input.termsVersion,
          privacyAcceptedAt: input.acceptedAt,
          privacyVersion: input.privacyVersion,
        }),
      );
    } catch (error) {
      const constraint = violatedUniqueConstraint(error);
      if (constraint === 'UQ_users_username_lower') {
        throw new UsernameTakenError();
      }
      if (constraint) {
        throw new EmailAlreadyRegisteredError();
      }
      throw error;
    }
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.users.update({ id }, { passwordHash });
  }
}
