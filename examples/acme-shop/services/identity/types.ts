export interface PaymentMethod {
  token: string;
  last4: string;
  brand: 'visa' | 'mastercard' | 'amex';
}

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  defaultCard?: PaymentMethod;
  createdAt: number;
}

export interface Session {
  token: string;
  userId: string;
  expiresAt: number;
}
