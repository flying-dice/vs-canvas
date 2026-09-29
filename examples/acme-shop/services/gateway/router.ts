import type { ApiRequest, Method, RouteHandler } from '../shared/http';
import { handleGetProduct, handleListProducts } from './routes/catalog';
import { handleStartCheckout } from './routes/checkout';
import { handleGetOrder, handleListOrders, handlePlaceOrder } from './routes/orders';
import { handleWebhook } from './routes/payments';
import { handleRatingSummary, handleSubmitReview } from './routes/reviews';
import { handleSearch } from './routes/search';

interface Route {
  method: Method;
  pattern: string;
  handler: RouteHandler;
}

export const routes: Route[] = [
  { method: 'GET', pattern: '/products', handler: handleListProducts },
  { method: 'GET', pattern: '/products/:id', handler: handleGetProduct },
  { method: 'GET', pattern: '/search', handler: handleSearch },
  { method: 'POST', pattern: '/checkout', handler: handleStartCheckout },
  { method: 'POST', pattern: '/orders', handler: handlePlaceOrder },
  { method: 'GET', pattern: '/orders', handler: handleListOrders },
  { method: 'GET', pattern: '/orders/:id', handler: handleGetOrder },
  { method: 'POST', pattern: '/products/:id/reviews', handler: handleSubmitReview },
  { method: 'GET', pattern: '/products/:id/rating', handler: handleRatingSummary },
  { method: 'POST', pattern: '/webhooks/paystream', handler: handleWebhook },
];

export function matchRoute(method: Method, path: string): { handler: RouteHandler; params: Record<string, string> } | undefined {
  for (const route of routes) {
    if (route.method !== method) continue;
    const want = route.pattern.split('/');
    const got = path.split('/');
    if (want.length !== got.length) continue;
    const params: Record<string, string> = {};
    const matches = want.every((part, i) => {
      if (part.startsWith(':')) {
        params[part.slice(1)] = got[i];
        return true;
      }
      return part === got[i];
    });
    if (matches) return { handler: route.handler, params };
  }
  return undefined;
}

export type { ApiRequest };
