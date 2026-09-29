export interface Carrier {
  name: string;
  baseRate: number;
  perKg: number;
  days: number;
}

export const carriers: Carrier[] = [
  { name: 'parcelly', baseRate: 4.5, perKg: 0.9, days: 5 },
  { name: 'swiftpost', baseRate: 8, perKg: 1.4, days: 2 },
];
