import { placeOrder } from '../api/orders';
import type { PlacedOrder } from '../api/orders';
import { h } from '../lib/h';
import { getCartState, setCartState } from '../state/cart';

interface CheckoutButtonProps {
  cartId: string;
  onPlaced: (order: PlacedOrder) => void;
  onError: (message: string) => void;
}

let submitting = false;

export async function handleClick(props: CheckoutButtonProps): Promise<void> {
  if (submitting) return;
  submitting = true;
  try {
    const order = await placeOrder({ cartId: props.cartId });
    setCartState({ itemCount: 0, total: 0 });
    props.onPlaced(order);
  } catch (error) {
    props.onError(error instanceof Error ? error.message : 'Payment failed');
  } finally {
    submitting = false;
  }
}

export function CheckoutButton(props: CheckoutButtonProps) {
  const { total } = getCartState();
  return (
    <button class="checkout-button" disabled={submitting} onClick={() => handleClick(props)}>
      {submitting ? 'Processing...' : `Pay $${total.toFixed(2)}`}
    </button>
  );
}
