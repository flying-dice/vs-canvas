import type { ProductSummary } from '../api/catalog';
import { h } from '../lib/h';

export function ProductCard(props: { product: ProductSummary; onAdd: (id: string) => void }) {
  const { product, onAdd } = props;
  return (
    <article class="product-card">
      <h3>{product.title}</h3>
      <span>${product.price.toFixed(2)}</span>
      <button onClick={() => onAdd(product.id)}>Add to cart</button>
    </article>
  );
}
