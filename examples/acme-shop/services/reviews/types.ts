export interface Review {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  text: string;
  createdAt: number;
}

export interface RatingSummary {
  productId: string;
  count: number;
  average: number;
}
