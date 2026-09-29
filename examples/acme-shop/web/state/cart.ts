export interface CartState {
  cartId: string;
  itemCount: number;
  total: number;
}

type Listener = (state: CartState) => void;

let state: CartState = { cartId: 'cart_812', itemCount: 3, total: 49 };
const listeners = new Set<Listener>();

export function getCartState(): CartState {
  return state;
}

export function setCartState(next: Partial<CartState>): void {
  state = { ...state, ...next };
  listeners.forEach((l) => l(state));
}

export function subscribeToCart(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
