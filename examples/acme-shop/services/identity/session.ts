import { UnauthorizedError } from '../shared/errors';
import { systemClock } from '../shared/clock';
import { prefixedId } from '../shared/ids';
import { MemoryRepo } from '../shared/memoryRepo';
import type { Session } from './types';

class SessionRepo extends MemoryRepo<Session & { id: string }> {}
const sessions = new SessionRepo();

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export function createSession(userId: string): Session {
  const token = prefixedId('sess');
  const session = { id: token, token, userId, expiresAt: systemClock.now() + SESSION_TTL_MS };
  sessions.save(session);
  return session;
}

export function resolveSession(token: string | undefined): Session {
  const session = token ? sessions.get(token) : undefined;
  if (!session || session.expiresAt < systemClock.now()) throw new UnauthorizedError();
  return session;
}
