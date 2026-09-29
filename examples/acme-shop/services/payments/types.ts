import type { Currency } from '../shared/types';

export interface CardToken {
  token: string;
  last4: string;
  brand: 'visa' | 'mastercard' | 'amex';
}

export interface Charge {
  id: string;
  orderId: string;
  amount: number;
  currency: Currency;
  status: 'pending' | 'succeeded' | 'failed';
  idempotencyKey: string;
  providerRef?: string;
  createdAt: number;
}

export interface ProviderChargeRequest {
  amount: number;
  card: CardToken;
  idempotencyKey?: string;
}

export interface ProviderCharge {
  id: string;
  status: 'succeeded' | 'declined';
  amount: number;
  declineReason?: string;
}

export interface PaymentProvider {
  charge(request: ProviderChargeRequest): Promise<ProviderCharge>;
  refund(providerRef: string, amount: number): Promise<{ id: string }>;
}

export interface RetryPolicy {
  maxAttempts: number;
  timeoutMs: number;
  backoffMs: number;
  providerName: string;
}
