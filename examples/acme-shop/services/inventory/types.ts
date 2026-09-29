export interface StockRecord {
  id: string;
  sku: string;
  onHand: number;
  reserved: number;
}

export interface Reservation {
  id: string;
  orderId: string;
  sku: string;
  quantity: number;
  expiresAt: number;
}
