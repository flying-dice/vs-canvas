import { getProduct, listProducts } from '../../catalog';
import { json } from '../../shared/http';
import type { ApiRequest } from '../../shared/http';

export async function handleListProducts(req: ApiRequest) {
  return json(listProducts({ category: req.query.category, limit: Number(req.query.limit ?? 20) }));
}

export async function handleGetProduct(req: ApiRequest) {
  return json(getProduct(req.params.id));
}
