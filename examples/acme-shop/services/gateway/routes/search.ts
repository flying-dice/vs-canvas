import { search } from '../../search';
import { json } from '../../shared/http';
import type { ApiRequest } from '../../shared/http';

export async function handleSearch(req: ApiRequest) {
  return json(search(req.query.q ?? '', Number(req.query.limit ?? 10)));
}
