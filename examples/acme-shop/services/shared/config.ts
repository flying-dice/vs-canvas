export interface AppConfig {
  env: 'development' | 'staging' | 'production';
  payments: {
    provider: string;
    timeoutMs: number;
    maxAttempts: number;
    backoffMs: number;
  };
  gateway: {
    port: number;
    rateLimitPerMinute: number;
  };
  inventory: {
    reservationTtlMs: number;
  };
  shipping: {
    freeThreshold: number;
  };
}

export const config: AppConfig = {
  env: 'production',
  payments: {
    provider: 'paystream',
    timeoutMs: 8000,
    maxAttempts: 3,
    backoffMs: 250,
  },
  gateway: {
    port: 8080,
    rateLimitPerMinute: 120,
  },
  inventory: {
    reservationTtlMs: 15 * 60 * 1000,
  },
  shipping: {
    freeThreshold: 75,
  },
};
