export interface CartItem {
  sku: string;
  quantity: number;
}

export interface Cart {
  id: string;
  userId: string;
  items: CartItem[];
  region: string;
  discountCode?: string;
  updatedAt: number;
}
