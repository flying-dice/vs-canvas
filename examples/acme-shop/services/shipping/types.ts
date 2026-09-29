export interface Address {
  line1: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

export interface Shipment {
  id: string;
  orderId: string;
  carrier: string;
  trackingCode: string;
  address: Address;
  createdAt: number;
}

export interface RateQuote {
  carrier: string;
  price: number;
  days: number;
}
