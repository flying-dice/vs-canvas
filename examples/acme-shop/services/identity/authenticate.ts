import { NotFoundError, UnauthorizedError } from '../shared/errors';
import { verifyPassword } from './passwords';
import { createSession } from './session';
import { userRepo } from './userRepo';
import type { PaymentMethod, Session, User } from './types';

export function login(email: string, password: string): Session {
  const user = userRepo.findByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) throw new UnauthorizedError('invalid credentials');
  return createSession(user.id);
}

export function getUser(userId: string): User {
  const user = userRepo.get(userId);
  if (!user) throw new NotFoundError('user', userId);
  return user;
}

export function getDefaultCard(userId: string): PaymentMethod {
  const card = getUser(userId).defaultCard;
  if (!card) throw new UnauthorizedError('no payment method on file');
  return card;
}
