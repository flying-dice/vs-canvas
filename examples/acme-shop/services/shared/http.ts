export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface ApiRequest<B = any> {
  method: Method;
  path: string;
  headers: Record<string, string>;
  params: Record<string, string>;
  query: Record<string, string>;
  body: B;
  userId?: string;
}

export interface ApiResponse<T = unknown> {
  status: number;
  body: T;
}

export type RouteHandler<B = any, T = unknown> = (req: ApiRequest<B>) => Promise<ApiResponse<T>>;

export function json<T>(body: T, status = 200): ApiResponse<T> {
  return { status, body };
}
