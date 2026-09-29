import type { PlacedOrder } from '../api/orders';
import { h } from '../lib/h';
import { CartSummary } from './CartSummary';
import { CheckoutButton } from './CheckoutButton';

export function App(props: { cartId: string }) {
  const onPlaced = (order: PlacedOrder) => console.log(`order ${order.id} placed for $${order.total}`);
  const onError = (message: string) => console.error(message);
  return (
    <main>
      <CartSummary />
      <CheckoutButton cartId={props.cartId} onPlaced={onPlaced} onError={onError} />
    </main>
  );
}
