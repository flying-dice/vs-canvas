import { h } from '../lib/h';
import { getCartState } from '../state/cart';

export function CartSummary() {
  const { itemCount, total } = getCartState();
  return (
    <section class="cart-summary">
      <h2>Your cart</h2>
      <p>{itemCount} items</p>
      <strong>${total.toFixed(2)}</strong>
    </section>
  );
}
