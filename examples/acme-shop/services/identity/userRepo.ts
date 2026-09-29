import { MemoryRepo } from '../shared/memoryRepo';
import { hashPassword } from './passwords';
import type { User } from './types';

export class UserRepo extends MemoryRepo<User> {
  findByEmail(email: string): User | undefined {
    return this.all().find((u) => u.email === email.toLowerCase());
  }
}

export const userRepo = new UserRepo();

userRepo.save({
  id: 'u_204',
  email: 'maria.ortega@example.com',
  name: 'Maria Ortega',
  passwordHash: hashPassword('correct horse'),
  defaultCard: { token: 'tok_visa_4242', last4: '4242', brand: 'visa' },
  createdAt: 1_690_000_000_000,
});
